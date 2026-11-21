'use strict';

/**
 * supabaseAnalytics.js
 *
 * Implements all complex analytical queries for analyticsEngine.js
 * using Supabase PostgREST (via @supabase/supabase-js).
 *
 * This replaces the SQL GROUP BY / JOIN / CTE queries that cannot be
 * handled by the simple supabaseAdapter since exec_sql RPC is not available.
 */

const { getAdminClient } = require('../../config/supabase');
const logger = require('../../config/logger');

const supabaseAnalytics = {

  /**
   * Total reviews count
   */
  async totalReviewCount() {
    const s = getAdminClient();
    const { data } = await s.from('reviews').select('id');
    return data?.length || 0;
  },

  /**
   * Average rating for a date range
   */
  async avgRatingInRange(startDate, endDate) {
    const s = getAdminClient();
    const { data } = await s.from('reviews')
      .select('rating')
      .gte('review_date', startDate)
      .lte('review_date', endDate);
    if (!data || data.length === 0) return { count: 0, avg: 0 };
    const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
    return { count: data.length, avg: Math.round(avg * 100) / 100 };
  },

  /**
   * Sentiment distribution across all reviews
   */
  async sentimentDistribution(propertyId = null) {
    const s = getAdminClient();
    let q = s.from('review_analyses').select('overall_sentiment, review_id');
    if (propertyId) {
      // Can't join easily — but all reviews for a property
      const { data: revIds } = await s.from('reviews')
        .select('id')
        .eq('property_id', propertyId);
      if (revIds && revIds.length > 0) {
        q = q.in('review_id', revIds.map(r => r.id));
      }
    }
    const { data } = await q.eq('analysis_status', 'completed');
    const counts = { positive: 0, negative: 0, neutral: 0, mixed: 0, unanalysed: 0 };
    (data || []).forEach(r => {
      const s = r.overall_sentiment || 'unanalysed';
      if (counts[s] !== undefined) counts[s]++;
      else counts.unanalysed++;
    });
    return counts;
  },

  /**
   * Per-property analytics (review count, avg rating, sentiment breakdown)
   */
  async propertyAnalytics() {
    const s = getAdminClient();
    const { data: props } = await s.from('properties').select('id, property_code, name, location').eq('is_active', true);
    if (!props) return [];

    const { data: reviews } = await s.from('reviews').select('id, property_id, rating');
    const { data: analyses } = await s.from('review_analyses').select('review_id, overall_sentiment').eq('analysis_status', 'completed');

    // Build maps
    const analysisMap = {};
    (analyses || []).forEach(a => { analysisMap[a.review_id] = a.overall_sentiment; });

    const result = props.map(p => {
      const propReviews = (reviews || []).filter(r => r.property_id === p.id);
      const count = propReviews.length;
      const avg = count > 0 ? Math.round((propReviews.reduce((s, r) => s + r.rating, 0) / count) * 100) / 100 : 0;

      const sentCounts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
      propReviews.forEach(r => {
        const sent = analysisMap[r.id];
        if (sent && sentCounts[sent] !== undefined) sentCounts[sent]++;
      });
      const analysed = sentCounts.positive + sentCounts.negative + sentCounts.neutral + sentCounts.mixed;

      return {
        id: p.id,
        property_code: p.property_code,
        name: p.name,
        location: p.location,
        review_count: count,
        avg_rating: avg,
        positive_count: sentCounts.positive,
        negative_count: sentCounts.negative,
        neutral_count: sentCounts.neutral,
        mixed_count: sentCounts.mixed,
        sentimentPercentages: {
          positive: analysed > 0 ? Math.round((sentCounts.positive / analysed) * 1000) / 10 : 0,
          negative: analysed > 0 ? Math.round((sentCounts.negative / analysed) * 1000) / 10 : 0,
          neutral: analysed > 0 ? Math.round((sentCounts.neutral / analysed) * 1000) / 10 : 0,
          mixed: analysed > 0 ? Math.round((sentCounts.mixed / analysed) * 1000) / 10 : 0,
        },
      };
    });

    return result.sort((a, b) => b.avg_rating - a.avg_rating);
  },

  /**
   * Daily rating trend for the last N days
   */
  async dailyRatingTrend(days = 14) {
    const s = getAdminClient();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const { data } = await s.from('reviews').select('review_date, rating').gte('review_date', sinceStr);
    if (!data || data.length === 0) return [];

    // Group by date
    const byDate = {};
    data.forEach(r => {
      const d = r.review_date?.split('T')[0] || r.review_date;
      if (!byDate[d]) byDate[d] = { total: 0, count: 0 };
      byDate[d].total += r.rating;
      byDate[d].count++;
    });

    return Object.entries(byDate)
      .map(([date, v]) => ({ date, avg_rating: Math.round((v.total / v.count) * 100) / 100, count: v.count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  /**
   * Top issues (negative topic mentions)
   */
  async topNegativeTopics(limit = 10) {
    const s = getAdminClient();
    const { data } = await s.from('review_topics').select('topic_name, topic_sentiment').eq('topic_sentiment', 'negative');
    if (!data || data.length === 0) return [];

    const counts = {};
    data.forEach(t => { counts[t.topic_name] = (counts[t.topic_name] || 0) + 1; });

    return Object.entries(counts)
      .map(([topic, count]) => ({ topic_name: topic, negative_count: count }))
      .sort((a, b) => b.negative_count - a.negative_count)
      .slice(0, limit);
  },

  /**
   * Properties list with review stats
   */
  async propertiesWithStats() {
    const s = getAdminClient();
    const { data: props } = await s.from('properties')
      .select('id, property_code, name, booking_url, location, country, timezone, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('property_code');

    if (!props) return [];

    const { data: reviews } = await s.from('reviews').select('id, property_id, rating');
    const propMap = {};
    (reviews || []).forEach(r => {
      if (!propMap[r.property_id]) propMap[r.property_id] = { total: 0, count: 0 };
      propMap[r.property_id].total += r.rating;
      propMap[r.property_id].count++;
    });

    return props.map(p => ({
      ...p,
      total_reviews: propMap[p.id]?.count || 0,
      avg_rating: propMap[p.id]?.count > 0
        ? Math.round((propMap[p.id].total / propMap[p.id].count) * 100) / 100
        : 0,
    }));
  },

  /**
   * Reviews list with pagination and filters – routed entirely through PostgREST
   */
  async reviewsList({ propertyCode, sentiment, minRating, maxRating, startDate, endDate, search, topic, page = 1, limit = 15, sortBy = 'review_date', sortOrder = 'desc' }) {
    const s = getAdminClient();

    // Find property_id if propertyCode given
    let propertyId = null;
    if (propertyCode && propertyCode !== 'ALL') {
      const { data: props } = await s.from('properties').select('id').eq('property_code', propertyCode).limit(1);
      propertyId = props?.[0]?.id || null;
    }

    // Fetch ALL reviews (with property join via property_id)
    let q = s.from('reviews').select('id, property_id, source, source_review_id, fingerprint, rating, review_date, positive_text, negative_text, full_text, language, reviewer_country, room_type, travel_type, provenance, collection_batch_id, collected_at, created_at, updated_at');

    if (propertyId) q = q.eq('property_id', propertyId);
    if (minRating) q = q.gte('rating', parseFloat(minRating));
    if (maxRating) q = q.lte('rating', parseFloat(maxRating));
    if (startDate) q = q.gte('review_date', startDate);
    if (endDate) q = q.lte('review_date', endDate);

    const ascending = sortOrder.toLowerCase() === 'asc';
    q = q.order(sortBy, { ascending });

    const { data: allReviews, error } = await q;
    if (error) {
      logger.error('[supabaseAnalytics.reviewsList] Error:', error.message);
      return { reviews: [], total: 0 };
    }

    // Fetch property names
    const { data: props } = await s.from('properties').select('id, property_code, name');
    const propById = {};
    (props || []).forEach(p => { propById[p.id] = p; });

    // Fetch analyses
    const { data: analyses } = await s.from('review_analyses')
      .select('review_id, overall_sentiment, sentiment_confidence, detected_language, manually_verified')
      .eq('analysis_status', 'completed');
    const analysisMap = {};
    (analyses || []).forEach(a => { if (!analysisMap[a.review_id]) analysisMap[a.review_id] = a; });

    // Fetch topics
    const { data: topics } = await s.from('review_topics').select('review_id, topic_name, topic_sentiment, confidence');
    const topicsMap = {};
    (topics || []).forEach(t => {
      if (!topicsMap[t.review_id]) topicsMap[t.review_id] = [];
      topicsMap[t.review_id].push({ topic_name: t.topic_name, topic_sentiment: t.topic_sentiment, confidence: t.confidence });
    });

    // Enrich and filter
    let enriched = (allReviews || []).map(r => {
      const prop = propById[r.property_id] || {};
      const analysis = analysisMap[r.id] || {};
      const rawName = r.provenance?.reviewer_name || r.provenance?.guest_name;
      const reviewerName = rawName && rawName !== 'Guest'
        ? rawName
        : (r.reviewer_country ? `${r.reviewer_country} Traveler` : 'Verified Guest');
      return {
        ...r,
        reviewer_name: reviewerName,
        property_name: prop.name || '',
        property_code: prop.property_code || '',
        overall_sentiment: analysis.overall_sentiment || null,
        sentiment_confidence: analysis.sentiment_confidence || null,
        detected_language: analysis.detected_language || r.language || 'en',
        manually_verified: analysis.manually_verified || false,
        topics: topicsMap[r.id] || [],
      };
    });

    // Client-side filters that PostgREST can't do easily
    if (sentiment && sentiment !== 'ALL') {
      enriched = enriched.filter(r => (r.overall_sentiment || '').toLowerCase() === sentiment.toLowerCase());
    }
    if (search) {
      const term = search.toLowerCase();
      enriched = enriched.filter(r => (r.full_text || '').toLowerCase().includes(term));
    }
    if (topic && topic !== 'ALL') {
      enriched = enriched.filter(r => r.topics.some(t => t.topic_name.toLowerCase() === topic.toLowerCase()));
    }

    const total = enriched.length;
    const offset = (page - 1) * limit;
    const pageData = enriched.slice(offset, offset + limit);

    return { reviews: pageData, total };
  },

  /**
   * Property details by id or code
   */
  async propertyById(id) {
    const s = getAdminClient();
    let q = s.from('properties')
      .select('id, property_code, name, booking_url, location, country, timezone, is_active, created_at, updated_at');
    if (id.includes('-') && id.length > 20) {
      q = q.eq('id', id);
    } else {
      q = q.eq('property_code', id);
    }
    const { data: props } = await q.limit(1);
    if (!props || props.length === 0) return null;
    const property = props[0];

    const { data: reviews } = await s.from('reviews')
      .select('id, rating, review_date, full_text, positive_text, negative_text, language, reviewer_country, provenance')
      .eq('property_id', property.id)
      .order('review_date', { ascending: false });

    const total = reviews?.length || 0;
    const avg = total > 0 ? Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / total) * 100) / 100 : 0;

    return {
      ...property,
      total_reviews: total,
      avg_rating: avg,
      recentReviews: (reviews || []).slice(0, 10),
    };
  },
};

module.exports = supabaseAnalytics;
