'use strict';

const dbConn = require('../database/connection');
const { getReportingPeriods } = require('./dateUtils');
const { calculatePriorityScore } = require('./priorityEngine');

/**
 * Core Analytics Engine querying actual Supabase PostgreSQL database tables.
 * No fake data or hardcoded KPI responses.
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
    const pool = options.poolOverride || dbConn.getPool();
    if (!pool) {
      return this._getEmptyOverview();
    }

    const periods = getReportingPeriods(options.referenceDate);
    const currStart = periods.currentWeek.startDate;
    const currEnd = periods.currentWeek.endDate;
    const prevStart = periods.previousWeekEquivalent.startDate;
    const prevEnd = periods.previousWeekEquivalent.endDate;

    // 1. Current week rating stats
    const currRes = await pool.query(`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(AVG(rating), 0) as avg_rating
      FROM reviews
      WHERE review_date >= $1 AND review_date <= $2
    `, [currStart, currEnd]);

    // 2. Previous week equivalent rating stats
    const prevRes = await pool.query(`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(AVG(rating), 0) as avg_rating
      FROM reviews
      WHERE review_date >= $1 AND review_date <= $2
    `, [prevStart, prevEnd]);

    // 3. Overall portfolio total count & all-time rating
    const totalRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_count,
        COALESCE(AVG(rating), 0) as all_time_avg_rating
      FROM reviews
    `);

    // 4. Sentiment counts across latest analysis records
    const sentRes = await pool.query(`
      SELECT 
        COALESCE(a.overall_sentiment, 'unanalysed') as sentiment,
        COUNT(*)::int as count
      FROM reviews r
      LEFT JOIN (
        SELECT DISTINCT ON (review_id) review_id, overall_sentiment
        FROM review_analyses
        WHERE analysis_status = 'completed'
        ORDER BY review_id, analyzed_at DESC
      ) a ON r.id = a.review_id
      GROUP BY COALESCE(a.overall_sentiment, 'unanalysed');
    `);

    const currAvg = Math.round(Number(currRes.rows[0]?.avg_rating || 0) * 100) / 100;
    const prevAvg = Math.round(Number(prevRes.rows[0]?.avg_rating || 0) * 100) / 100;
    const ratingDiff = Math.round((currAvg - prevAvg) * 100) / 100;

    const totalReviews = Number(totalRes.rows[0]?.total_count || 0);
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0, mixed: 0, unanalysed: 0 };

    let analysedTotal = 0;
    for (const row of sentRes.rows) {
      if (sentimentCounts[row.sentiment] !== undefined) {
        sentimentCounts[row.sentiment] = Number(row.count);
        if (row.sentiment !== 'unanalysed') {
          analysedTotal += Number(row.count);
        }
      }
    }

    const calcPct = (cnt) => analysedTotal > 0 ? Math.round((cnt / analysedTotal) * 1000) / 10 : 0;

    return {
      period: periods,
      kpis: {
        currentWeekAverageRating: currAvg,
        currentWeekReviewCount: Number(currRes.rows[0]?.count || 0),
        previousWeekAverageRating: prevAvg,
        previousWeekReviewCount: Number(prevRes.rows[0]?.count || 0),
        ratingDifference: ratingDiff,
        ratingTrend: ratingDiff > 0 ? 'improving' : ratingDiff < 0 ? 'declining' : 'stable',
        totalReviewCount: totalReviews,
        allTimeAverageRating: Math.round(Number(totalRes.rows[0]?.all_time_avg_rating || 0) * 100) / 100,
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

  /**
   * 2. Property-wise ratings & sentiment comparisons
   */
  async getPropertyAnalytics(options = {}) {
    const pool = options.poolOverride || dbConn.getPool();
    if (!pool) return [];

    const res = await pool.query(`
      SELECT 
        p.id,
        p.property_code,
        p.name,
        p.location,
        COUNT(r.id)::int as review_count,
        COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0)::float as avg_rating,
        COUNT(CASE WHEN a.overall_sentiment = 'positive' THEN 1 END)::int as positive_count,
        COUNT(CASE WHEN a.overall_sentiment = 'negative' THEN 1 END)::int as negative_count,
        COUNT(CASE WHEN a.overall_sentiment = 'neutral' THEN 1 END)::int as neutral_count,
        COUNT(CASE WHEN a.overall_sentiment = 'mixed' THEN 1 END)::int as mixed_count
      FROM properties p
      LEFT JOIN reviews r ON p.id = r.property_id
      LEFT JOIN (
        SELECT DISTINCT ON (review_id) review_id, overall_sentiment
        FROM review_analyses
        WHERE analysis_status = 'completed'
        ORDER BY review_id, analyzed_at DESC
      ) a ON r.id = a.review_id
      WHERE p.is_active = true
      GROUP BY p.id, p.property_code, p.name, p.location
      ORDER BY avg_rating DESC;
    `);

    return res.rows.map(row => {
      const analysed = row.positive_count + row.negative_count + row.neutral_count + row.mixed_count;
      return {
        ...row,
        sentimentPercentages: {
          positive: analysed > 0 ? Math.round((row.positive_count / analysed) * 1000) / 10 : 0,
          negative: analysed > 0 ? Math.round((row.negative_count / analysed) * 1000) / 10 : 0,
          neutral: analysed > 0 ? Math.round((row.neutral_count / analysed) * 1000) / 10 : 0,
          mixed: analysed > 0 ? Math.round((row.mixed_count / analysed) * 1000) / 10 : 0,
        },
      };
    });
  }

  /**
   * 3. Daily rating trends & weekly sentiment trends
   */
  async getTrends(options = {}) {
    const pool = options.poolOverride || dbConn.getPool();
    if (!pool) return { dailyRatings: [], weeklySentiment: [] };

    const { days = 30 } = options;

    // Daily rating trends
    const dailyRes = await pool.query(`
      SELECT 
        review_date as date,
        COUNT(*)::int as review_count,
        ROUND(AVG(rating)::numeric, 2)::float as avg_rating
      FROM reviews
      WHERE review_date >= CURRENT_DATE - ($1 || ' days')::interval
      GROUP BY review_date
      ORDER BY review_date ASC;
    `, [days]);

    // Weekly sentiment trends
    const weeklyRes = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('week', r.review_date), 'YYYY-MM-DD') as week_start,
        COUNT(*)::int as total_reviews,
        COUNT(CASE WHEN a.overall_sentiment = 'positive' THEN 1 END)::int as positive_count,
        COUNT(CASE WHEN a.overall_sentiment = 'negative' THEN 1 END)::int as negative_count,
        COUNT(CASE WHEN a.overall_sentiment = 'neutral' THEN 1 END)::int as neutral_count,
        COUNT(CASE WHEN a.overall_sentiment = 'mixed' THEN 1 END)::int as mixed_count
      FROM reviews r
      JOIN (
        SELECT DISTINCT ON (review_id) review_id, overall_sentiment
        FROM review_analyses
        WHERE analysis_status = 'completed'
        ORDER BY review_id, analyzed_at DESC
      ) a ON r.id = a.review_id
      WHERE r.review_date >= CURRENT_DATE - INTERVAL '12 weeks'
      GROUP BY DATE_TRUNC('week', r.review_date)
      ORDER BY DATE_TRUNC('week', r.review_date) ASC;
    `);

    return {
      dailyRatings: dailyRes.rows,
      weeklySentiment: weeklyRes.rows,
    };
  }

  /**
   * 4. Topics Analytics:
   * - Positive and negative topic trends
   * - Percentage of negative reviews mentioning topic:
   *   (Negative reviews mentioning topic / All negative reviews) * 100
   * - Operational priority scores
   */
  async getTopicAnalytics(options = {}) {
    const pool = options.poolOverride || dbConn.getPool();
    if (!pool) return { topics: [], totalNegativeReviews: 0 };

    // Total count of negative reviews
    const negCountRes = await pool.query(`
      SELECT COUNT(DISTINCT r.id)::int as total_negative
      FROM reviews r
      JOIN (
        SELECT DISTINCT ON (review_id) review_id, overall_sentiment
        FROM review_analyses
        WHERE analysis_status = 'completed'
        ORDER BY review_id, analyzed_at DESC
      ) a ON r.id = a.review_id
      WHERE a.overall_sentiment IN ('negative', 'mixed');
    `);
    const totalNegativeReviews = Number(negCountRes.rows[0]?.total_negative || 0);

    // Topic aggregated counts, distinct review counts, and average ratings
    const topicRes = await pool.query(`
      SELECT 
        t.topic_name,
        COUNT(DISTINCT CASE WHEN t.topic_sentiment = 'positive' THEN t.review_id END)::int as positive_count,
        COUNT(DISTINCT CASE WHEN t.topic_sentiment = 'negative' THEN t.review_id END)::int as negative_count,
        COUNT(DISTINCT CASE WHEN t.topic_sentiment = 'neutral' THEN t.review_id END)::int as neutral_count,
        COUNT(DISTINCT t.review_id)::int as total_mention_count,
        COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0)::float as avg_rating_for_topic
      FROM review_topics t
      JOIN reviews r ON t.review_id = r.id
      GROUP BY t.topic_name
      ORDER BY negative_count DESC, total_mention_count DESC;
    `);

    // For property concentration calculation: find highest negative count for each topic in a single hotel
    const concRes = await pool.query(`
      SELECT 
        t.topic_name,
        MAX(prop_counts.neg_cnt)::int as max_property_count
      FROM review_topics t
      JOIN (
        SELECT t2.topic_name, r2.property_id, COUNT(DISTINCT t2.review_id) as neg_cnt
        FROM review_topics t2
        JOIN reviews r2 ON t2.review_id = r2.id
        WHERE t2.topic_sentiment = 'negative'
        GROUP BY t2.topic_name, r2.property_id
      ) prop_counts ON t.topic_name = prop_counts.topic_name
      GROUP BY t.topic_name;
    `);

    const concMap = {};
    for (const r of concRes.rows) {
      concMap[r.topic_name] = r.max_property_count;
    }

    const topicsWithPriority = topicRes.rows.map(row => {
      const negativeReviewsMentioning = row.negative_count;
      // Formula: Negative reviews mentioning cleanliness / All negative reviews × 100
      const negativePercentage = totalNegativeReviews > 0
        ? Math.round((negativeReviewsMentioning / totalNegativeReviews) * 1000) / 10
        : 0;

      const priority = calculatePriorityScore({
        topicName: row.topic_name,
        negativeCount: negativeReviewsMentioning,
        totalNegativeReviews,
        avgRatingForTopic: row.avg_rating_for_topic,
        maxPropertyCount: concMap[row.topic_name] || 0,
      });

      return {
        topicName: row.topic_name,
        mentionCount: row.total_mention_count,
        positiveCount: row.positive_count,
        negativeCount: row.negative_count,
        neutralCount: row.neutral_count,
        negativeReviewPercentage: negativePercentage,
        averageRatingWhenMentioned: row.avg_rating_for_topic,
        priority,
      };
    });

    // Sort by priority score descending
    topicsWithPriority.sort((a, b) => b.priority.score - a.priority.score);

    return {
      totalNegativeReviews,
      topics: topicsWithPriority,
      mostCommonComplaints: topicsWithPriority
        .filter(t => t.negativeCount > 0)
        .slice(0, 5)
        .map(t => ({
          topic: t.topicName,
          negativeCount: t.negativeCount,
          complaintPercentage: t.negativeReviewPercentage,
          priorityLevel: t.priority.level,
        })),
    };
  }

  /**
   * 5. Sentiment breakdown with property concentration
   */
  async getSentimentAnalytics(options = {}) {
    const pool = options.poolOverride || dbConn.getPool();
    if (!pool) return { distribution: {}, byProperty: [] };

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

