'use strict';

const { getReportingPeriods } = require('./dateUtils');
const { calculatePriorityScore } = require('./priorityEngine');
const supabaseAnalytics = require('../database/supabaseAnalytics');

/**
 * Core Analytics Engine — all queries routed through supabaseAnalytics (PostgREST).
 * No pg.Pool / SQL required; works over Supabase @supabase/supabase-js client.
 */
class AnalyticsEngine {
  /**
   * 1. Overview KPIs:
   * - Average rating for current week (Sydney Monday - today)
   * - Previous week average rating (equivalent elapsed period)
   * - Rating difference
   * - Total review count
   * - Sentiment percentages (positive, negative, neutral, mixed)
   */
  async getOverview(options = {}) {
    const dbConn = require('../database/connection');
    const pool = options.poolOverride || dbConn.getPool();
    if (pool && !pool.isSupabaseAdapter) {
      return this._getOverviewViaPool({ ...options, poolOverride: pool });
    }

    const periods = getReportingPeriods(options.referenceDate);
    const currStart = periods.currentWeek.startDate;
    const currEnd = periods.currentWeek.endDate;
    const prevStart = periods.previousWeekEquivalent.startDate;
    const prevEnd = periods.previousWeekEquivalent.endDate;

    const [currData, prevData, totalCount, sentimentDist] = await Promise.all([
      supabaseAnalytics.avgRatingInRange(currStart, currEnd),
      supabaseAnalytics.avgRatingInRange(prevStart, prevEnd),
      supabaseAnalytics.totalReviewCount(),
      supabaseAnalytics.sentimentDistribution(),
    ]);

    const currAvg = Math.round((currData.avg || 0) * 100) / 100;
    const prevAvg = Math.round((prevData.avg || 0) * 100) / 100;
    const ratingDiff = Math.round((currAvg - prevAvg) * 100) / 100;

    const sentimentCounts = {
      positive: sentimentDist.positive || 0,
      negative: sentimentDist.negative || 0,
      neutral: sentimentDist.neutral || 0,
      mixed: sentimentDist.mixed || 0,
      unanalysed: sentimentDist.unanalysed || 0,
    };
    const analysedTotal = sentimentCounts.positive + sentimentCounts.negative + sentimentCounts.neutral + sentimentCounts.mixed;
    const calcPct = (cnt) => analysedTotal > 0 ? Math.round((cnt / analysedTotal) * 1000) / 10 : 0;

    // All-time avg: fetch all ratings
    const { getAdminClient } = require('../../config/supabase');
    const s = getAdminClient();
    const { data: allRatings } = await s.from('reviews').select('rating');
    const allTimeAvg = allRatings && allRatings.length > 0
      ? Math.round((allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length) * 100) / 100
      : 0;

    return {
      period: periods,
      kpis: {
        currentWeekAverageRating: currAvg,
        currentWeekReviewCount: currData.count || 0,
        previousWeekAverageRating: prevAvg,
        previousWeekReviewCount: prevData.count || 0,
        ratingDifference: ratingDiff,
        ratingTrend: ratingDiff > 0 ? 'improving' : ratingDiff < 0 ? 'declining' : 'stable',
        totalReviewCount: totalCount,
        allTimeAverageRating: allTimeAvg,
      },
      sentimentDistribution: {
        totalAnalysed: analysedTotal,
        counts: sentimentCounts,
        percentages: {
          positive: calcPct(sentimentCounts.positive),
          negative: calcPct(sentimentCounts.negative),
          neutral: calcPct(sentimentCounts.neutral),
          mixed: calcPct(sentimentCounts.mixed),
        },
      },
    };
  }

  /** Fallback for test pool injection */
  async _getOverviewViaPool(options) {
    const pool = options.poolOverride;
    const periods = getReportingPeriods(options.referenceDate);
    const { currentWeek: { startDate: currStart, endDate: currEnd }, previousWeekEquivalent: { startDate: prevStart, endDate: prevEnd } } = periods;

    const [currRes, prevRes, totalRes, sentRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int as count, COALESCE(AVG(rating), 0) as avg_rating FROM reviews WHERE review_date >= $1 AND review_date <= $2`, [currStart, currEnd]),
      pool.query(`SELECT COUNT(*)::int as count, COALESCE(AVG(rating), 0) as avg_rating FROM reviews WHERE review_date >= $1 AND review_date <= $2`, [prevStart, prevEnd]),
      pool.query(`SELECT COUNT(*)::int as total_count, COALESCE(AVG(rating), 0) as all_time_avg_rating FROM reviews`),
      pool.query(`SELECT COALESCE(a.overall_sentiment, 'unanalysed') as sentiment, COUNT(*)::int as count FROM reviews r LEFT JOIN (SELECT DISTINCT ON (review_id) review_id, overall_sentiment FROM review_analyses WHERE analysis_status = 'completed' ORDER BY review_id, analyzed_at DESC) a ON r.id = a.review_id GROUP BY COALESCE(a.overall_sentiment, 'unanalysed')`),
    ]);

    const currAvg = Math.round(Number(currRes.rows[0]?.avg_rating || 0) * 100) / 100;
    const prevAvg = Math.round(Number(prevRes.rows[0]?.avg_rating || 0) * 100) / 100;
    const ratingDiff = Math.round((currAvg - prevAvg) * 100) / 100;
    const totalReviews = Number(totalRes.rows[0]?.total_count || 0);
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0, mixed: 0, unanalysed: 0 };
    let analysedTotal = 0;
    for (const row of sentRes.rows) {
      if (sentimentCounts[row.sentiment] !== undefined) {
        sentimentCounts[row.sentiment] = Number(row.count);
        if (row.sentiment !== 'unanalysed') analysedTotal += Number(row.count);
      }
    }
    const calcPct = (cnt) => analysedTotal > 0 ? Math.round((cnt / analysedTotal) * 1000) / 10 : 0;
    return {
      period: periods,
      kpis: { currentWeekAverageRating: currAvg, currentWeekReviewCount: Number(currRes.rows[0]?.count || 0), previousWeekAverageRating: prevAvg, previousWeekReviewCount: Number(prevRes.rows[0]?.count || 0), ratingDifference: ratingDiff, ratingTrend: ratingDiff > 0 ? 'improving' : ratingDiff < 0 ? 'declining' : 'stable', totalReviewCount: totalReviews, allTimeAverageRating: Math.round(Number(totalRes.rows[0]?.all_time_avg_rating || 0) * 100) / 100 },
      sentimentDistribution: { totalAnalysed: analysedTotal, counts: sentimentCounts, percentages: { positive: calcPct(sentimentCounts.positive), negative: calcPct(sentimentCounts.negative), neutral: calcPct(sentimentCounts.neutral), mixed: calcPct(sentimentCounts.mixed) } },
    };
  }

  /**
   * 2. Property-wise ratings & sentiment comparisons
   */
  async getPropertyAnalytics(options = {}) {
    const dbConn = require('../database/connection');
    const pool = options.poolOverride || dbConn.getPool();
    if (pool && !pool.isSupabaseAdapter) {
      return this._getPropertyAnalyticsViaPool({ ...options, poolOverride: pool });
    }
    return supabaseAnalytics.propertyAnalytics();
  }

  /** Fallback for test pool injection */
  async _getPropertyAnalyticsViaPool(options) {
    const pool = options.poolOverride;
    const res = await pool.query(`
      SELECT p.id, p.property_code, p.name, p.location,
        COUNT(r.id)::int as review_count,
        COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0)::float as avg_rating,
        COUNT(CASE WHEN a.overall_sentiment = 'positive' THEN 1 END)::int as positive_count,
        COUNT(CASE WHEN a.overall_sentiment = 'negative' THEN 1 END)::int as negative_count,
        COUNT(CASE WHEN a.overall_sentiment = 'neutral' THEN 1 END)::int as neutral_count,
        COUNT(CASE WHEN a.overall_sentiment = 'mixed' THEN 1 END)::int as mixed_count
      FROM properties p
      LEFT JOIN reviews r ON p.id = r.property_id
      LEFT JOIN (SELECT DISTINCT ON (review_id) review_id, overall_sentiment FROM review_analyses WHERE analysis_status = 'completed' ORDER BY review_id, analyzed_at DESC) a ON r.id = a.review_id
      WHERE p.is_active = true
      GROUP BY p.id, p.property_code, p.name, p.location
      ORDER BY avg_rating DESC;
    `);
    return res.rows.map(row => {
      const analysed = row.positive_count + row.negative_count + row.neutral_count + row.mixed_count;
      return { ...row, sentimentPercentages: { positive: analysed > 0 ? Math.round((row.positive_count / analysed) * 1000) / 10 : 0, negative: analysed > 0 ? Math.round((row.negative_count / analysed) * 1000) / 10 : 0, neutral: analysed > 0 ? Math.round((row.neutral_count / analysed) * 1000) / 10 : 0, mixed: analysed > 0 ? Math.round((row.mixed_count / analysed) * 1000) / 10 : 0 } };
    });
  }

  /**
   * 3. Daily rating trends & weekly sentiment trends
   */
  async getTrends(options = {}) {
    const dbConn = require('../database/connection');
    const pool = options.poolOverride || dbConn.getPool();
    if (pool && !pool.isSupabaseAdapter) {
      return this._getTrendsViaPool({ ...options, poolOverride: pool });
    }
    const { days = 30 } = options;
    const dailyRatings = await supabaseAnalytics.dailyRatingTrend(days);

    // Weekly sentiment — compute from raw data
    const { getAdminClient } = require('../../config/supabase');
    const s = getAdminClient();
    const since = new Date();
    since.setDate(since.getDate() - 84);
    const sinceStr = since.toISOString().split('T')[0];

    const { data: reviews } = await s.from('reviews').select('id, review_date').gte('review_date', sinceStr);
    const { data: analyses } = await s.from('review_analyses').select('review_id, overall_sentiment').eq('analysis_status', 'completed');

    const analysisMap = {};
    (analyses || []).forEach(a => { if (!analysisMap[a.review_id]) analysisMap[a.review_id] = a.overall_sentiment; });

    const weekMap = {};
    (reviews || []).forEach(r => {
      const d = new Date(r.review_date);
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(d.setDate(diff));
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weekMap[weekKey]) weekMap[weekKey] = { week_start: weekKey, total_reviews: 0, positive_count: 0, negative_count: 0, neutral_count: 0, mixed_count: 0 };
      weekMap[weekKey].total_reviews++;
      const sent = analysisMap[r.id] || 'unanalysed';
      if (weekMap[weekKey][`${sent}_count`] !== undefined) weekMap[weekKey][`${sent}_count`]++;
    });

    const weeklySentiment = Object.values(weekMap).sort((a, b) => a.week_start.localeCompare(b.week_start));

    return { dailyRatings, weeklySentiment };
  }

  async _getTrendsViaPool(options) {
    const pool = options.poolOverride;
    const { days = 30 } = options;
    const [dailyRes, weeklyRes] = await Promise.all([
      pool.query(`SELECT review_date as date, COUNT(*)::int as review_count, ROUND(AVG(rating)::numeric, 2)::float as avg_rating FROM reviews WHERE review_date >= CURRENT_DATE - ($1 || ' days')::interval GROUP BY review_date ORDER BY review_date ASC`, [days]),
      pool.query(`SELECT TO_CHAR(DATE_TRUNC('week', r.review_date), 'YYYY-MM-DD') as week_start, COUNT(*)::int as total_reviews, COUNT(CASE WHEN a.overall_sentiment = 'positive' THEN 1 END)::int as positive_count, COUNT(CASE WHEN a.overall_sentiment = 'negative' THEN 1 END)::int as negative_count, COUNT(CASE WHEN a.overall_sentiment = 'neutral' THEN 1 END)::int as neutral_count, COUNT(CASE WHEN a.overall_sentiment = 'mixed' THEN 1 END)::int as mixed_count FROM reviews r JOIN (SELECT DISTINCT ON (review_id) review_id, overall_sentiment FROM review_analyses WHERE analysis_status = 'completed' ORDER BY review_id, analyzed_at DESC) a ON r.id = a.review_id WHERE r.review_date >= CURRENT_DATE - INTERVAL '84 days' GROUP BY DATE_TRUNC('week', r.review_date) ORDER BY DATE_TRUNC('week', r.review_date) ASC`),
    ]);
    return { dailyRatings: dailyRes.rows, weeklySentiment: weeklyRes.rows };
  }

  /**
   * 4. Topics Analytics
   */
  async getTopicAnalytics(options = {}) {
    const dbConn = require('../database/connection');
    const pool = options.poolOverride || dbConn.getPool();
    if (pool && !pool.isSupabaseAdapter) {
      return this._getTopicAnalyticsViaPool({ ...options, poolOverride: pool });
    }

    const { getAdminClient } = require('../../config/supabase');
    const s = getAdminClient();

    // All analyses to find negative reviews
    const { data: analyses } = await s.from('review_analyses').select('review_id, overall_sentiment').eq('analysis_status', 'completed');
    const negReviewIds = new Set((analyses || []).filter(a => a.overall_sentiment === 'negative' || a.overall_sentiment === 'mixed').map(a => a.review_id));
    const totalNegativeReviews = negReviewIds.size;

    // All topics with review ratings
    const { data: topics } = await s.from('review_topics').select('review_id, topic_name, topic_sentiment, confidence');
    const { data: reviews } = await s.from('reviews').select('id, rating, property_id');

    const ratingByReviewId = {};
    (reviews || []).forEach(r => { ratingByReviewId[r.id] = { rating: r.rating, property_id: r.property_id }; });

    // Group by topic_name
    const topicMap = {};
    (topics || []).forEach(t => {
      if (!topicMap[t.topic_name]) topicMap[t.topic_name] = { topic_name: t.topic_name, reviews: new Set(), positive: new Set(), negative: new Set(), neutral: new Set(), ratings: [], propertyNegCounts: {} };
      const tm = topicMap[t.topic_name];
      tm.reviews.add(t.review_id);
      if (t.topic_sentiment === 'positive') tm.positive.add(t.review_id);
      else if (t.topic_sentiment === 'negative') tm.negative.add(t.review_id);
      else if (t.topic_sentiment === 'neutral') tm.neutral.add(t.review_id);
      const rv = ratingByReviewId[t.review_id];
      if (rv) {
        tm.ratings.push(rv.rating);
        if (t.topic_sentiment === 'negative') {
          const pid = rv.property_id;
          tm.propertyNegCounts[pid] = (tm.propertyNegCounts[pid] || 0) + 1;
        }
      }
    });

    const topicsWithPriority = Object.values(topicMap).map(tm => {
      const negativeCount = tm.negative.size;
      const avgRatingForTopic = tm.ratings.length > 0 ? Math.round((tm.ratings.reduce((s, r) => s + r, 0) / tm.ratings.length) * 100) / 100 : 0;
      const maxPropertyCount = Math.max(0, ...Object.values(tm.propertyNegCounts));
      const negativePercentage = totalNegativeReviews > 0 ? Math.round((negativeCount / totalNegativeReviews) * 1000) / 10 : 0;
      const priority = calculatePriorityScore({ topicName: tm.topic_name, negativeCount, totalNegativeReviews, avgRatingForTopic, maxPropertyCount });
      return {
        topicName: tm.topic_name,
        mentionCount: tm.reviews.size,
        positiveCount: tm.positive.size,
        negativeCount,
        neutralCount: tm.neutral.size,
        negativeReviewPercentage: negativePercentage,
        averageRatingWhenMentioned: avgRatingForTopic,
        priority,
      };
    });

    topicsWithPriority.sort((a, b) => b.priority.score - a.priority.score);

    return {
      totalNegativeReviews,
      topics: topicsWithPriority,
      mostCommonComplaints: topicsWithPriority.filter(t => t.negativeCount > 0).slice(0, 5).map(t => ({
        topic: t.topicName, negativeCount: t.negativeCount, complaintPercentage: t.negativeReviewPercentage, priorityLevel: t.priority.level,
      })),
    };
  }

  async _getTopicAnalyticsViaPool(options) {
    const pool = options.poolOverride;
    const negCountRes = await pool.query(`SELECT COUNT(DISTINCT r.id)::int as total_negative FROM reviews r JOIN (SELECT DISTINCT ON (review_id) review_id, overall_sentiment FROM review_analyses WHERE analysis_status = 'completed' ORDER BY review_id, analyzed_at DESC) a ON r.id = a.review_id WHERE a.overall_sentiment IN ('negative', 'mixed')`);
    const totalNegativeReviews = Number(negCountRes.rows[0]?.total_negative || 0);
    const topicRes = await pool.query(`SELECT t.topic_name, COUNT(DISTINCT CASE WHEN t.topic_sentiment = 'positive' THEN t.review_id END)::int as positive_count, COUNT(DISTINCT CASE WHEN t.topic_sentiment = 'negative' THEN t.review_id END)::int as negative_count, COUNT(DISTINCT CASE WHEN t.topic_sentiment = 'neutral' THEN t.review_id END)::int as neutral_count, COUNT(DISTINCT t.review_id)::int as total_mention_count, COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0)::float as avg_rating_for_topic FROM review_topics t JOIN reviews r ON t.review_id = r.id GROUP BY t.topic_name ORDER BY negative_count DESC, total_mention_count DESC`);
    const concRes = await pool.query(`SELECT t.topic_name, MAX(prop_counts.neg_cnt)::int as max_property_count FROM review_topics t JOIN (SELECT t2.topic_name, r2.property_id, COUNT(DISTINCT t2.review_id) as neg_cnt FROM review_topics t2 JOIN reviews r2 ON t2.review_id = r2.id WHERE t2.topic_sentiment = 'negative' GROUP BY t2.topic_name, r2.property_id) prop_counts ON t.topic_name = prop_counts.topic_name GROUP BY t.topic_name`);
    const concMap = {};
    for (const r of concRes.rows) concMap[r.topic_name] = r.max_property_count;
    const topicsWithPriority = topicRes.rows.map(row => {
      const negativeReviewsMentioning = row.negative_count;
      const negativePercentage = totalNegativeReviews > 0 ? Math.round((negativeReviewsMentioning / totalNegativeReviews) * 1000) / 10 : 0;
      const priority = calculatePriorityScore({ topicName: row.topic_name, negativeCount: negativeReviewsMentioning, totalNegativeReviews, avgRatingForTopic: row.avg_rating_for_topic, maxPropertyCount: concMap[row.topic_name] || 0 });
      return { topicName: row.topic_name, mentionCount: row.total_mention_count, positiveCount: row.positive_count, negativeCount: row.negative_count, neutralCount: row.neutral_count, negativeReviewPercentage: negativePercentage, averageRatingWhenMentioned: row.avg_rating_for_topic, priority };
    });
    topicsWithPriority.sort((a, b) => b.priority.score - a.priority.score);
    return { totalNegativeReviews, topics: topicsWithPriority, mostCommonComplaints: topicsWithPriority.filter(t => t.negativeCount > 0).slice(0, 5).map(t => ({ topic: t.topicName, negativeCount: t.negativeCount, complaintPercentage: t.negativeReviewPercentage, priorityLevel: t.priority.level })) };
  }

  /**
   * 5. Sentiment breakdown with property concentration
   */
  async getSentimentAnalytics(options = {}) {
    const overview = await this.getOverview(options);
    const properties = await this.getPropertyAnalytics(options);

    return {
      portfolioDistribution: overview.sentimentDistribution,
      propertySentiment: properties.map(p => ({
        propertyCode: p.property_code,
        propertyName: p.name,
        percentages: p.sentimentPercentages,
      })),
    };
  }

  _getEmptyOverview() {
    return {
      period: getReportingPeriods(),
      kpis: {
        currentWeekAverageRating: 0,
        currentWeekReviewCount: 0,
        previousWeekAverageRating: 0,
        previousWeekReviewCount: 0,
        ratingDifference: 0,
        ratingTrend: 'stable',
        totalReviewCount: 0,
        allTimeAverageRating: 0,
      },
      sentimentDistribution: {
        totalAnalysed: 0,
        counts: { positive: 0, negative: 0, neutral: 0, mixed: 0, unanalysed: 0 },
        percentages: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
      },
    };
  }
}

module.exports = new AnalyticsEngine();
