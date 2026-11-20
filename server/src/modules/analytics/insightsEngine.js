'use strict';

const dbConn = require('../database/connection');
const analyticsEngine = require('./analyticsEngine');

/**
 * Actionable Insights Engine
 * Generates data-driven operational insights from actual database calculations.
 * Every insight is backed by verified review IDs and review text.
 * Never invents causes or unsupported facts.
 */
class InsightsEngine {
  /**
   * Generates actionable insights with direct review evidence.
   */
  async getInsights(options = {}) {
    const pool = options.poolOverride || dbConn.getPool();
    if (!pool) return [];

    const insights = [];

    // 1. Analyze high priority operational complaints
    const topicData = await analyticsEngine.getTopicAnalytics(options);
    const criticalTopics = topicData.topics.filter(t => t.priority.level === 'Critical' || t.priority.level === 'High');

    for (const topic of criticalTopics.slice(0, 3)) {
      // Find supporting review evidence
      const evidenceRes = await pool.query(`
        SELECT 
          r.id,
          r.rating,
          r.review_date,
          r.full_text,
          p.name as property_name,
          p.property_code
        FROM review_topics t
        JOIN reviews r ON t.review_id = r.id
        JOIN properties p ON r.property_id = p.id
        WHERE t.topic_name = $1 AND t.topic_sentiment = 'negative'
        ORDER BY r.review_date DESC, r.rating ASC
        LIMIT 3;
      `, [topic.topicName]);

      if (evidenceRes.rows.length > 0) {
        const topProperty = evidenceRes.rows[0].property_name;
        insights.push({
          id: `INSIGHT-TOPIC-${topic.topicName.toUpperCase().replace(/\s+/g, '_')}`,
          type: 'operational_priority',
          urgency: topic.priority.level === 'Critical' ? 'immediate' : 'high',
          category: topic.topicName,
          title: `Elevated guest complaints regarding ${topic.topicName}`,
          description: `${topic.topicName} is mentioned negatively in ${topic.negativeCount} reviews (${topic.negativeReviewPercentage}% of all negative feedback), with an average guest rating of ${topic.averageRatingWhenMentioned}/10. Priority score: ${topic.priority.score}/100.`,
          recommendedAction: `Inspect operational procedures, equipment, or staff training related to ${topic.topicName.toLowerCase()}, especially at ${topProperty}.`,
          evidenceCount: topic.negativeCount,
          sampleEvidence: evidenceRes.rows.map(row => ({
            reviewId: row.id,
            property: row.property_name,
            date: row.review_date,
            rating: row.rating,
            quote: row.full_text,
          })),
        });
      }
    }

    // 2. Analyze standout strengths / positive feedback
    const strongTopics = topicData.topics
      .filter(t => t.positiveCount >= 5 && t.positiveCount > (t.negativeCount * 2))
      .sort((a, b) => b.positiveCount - a.positiveCount);

    if (strongTopics.length > 0) {
      const best = strongTopics[0];
      const posEvidence = await pool.query(`
        SELECT 
          r.id,
          r.rating,
          r.review_date,
          r.full_text,
          p.name as property_name
        FROM review_topics t
        JOIN reviews r ON t.review_id = r.id
        JOIN properties p ON r.property_id = p.id
        WHERE t.topic_name = $1 AND t.topic_sentiment = 'positive'
        ORDER BY r.rating DESC, r.review_date DESC
        LIMIT 3;
      `, [best.topicName]);

      insights.push({
        id: `INSIGHT-STRENGTH-${best.topicName.toUpperCase().replace(/\s+/g, '_')}`,
        type: 'operational_strength',
        urgency: 'low',
        category: best.topicName,
        title: `Consistent excellence in ${best.topicName}`,
        description: `${best.topicName} generated ${best.positiveCount} positive guest mentions with an outstanding average rating of ${best.averageRatingWhenMentioned}/10.`,
        recommendedAction: `Acknowledge hotel team members responsible for maintaining high standards in ${best.topicName.toLowerCase()}.`,
        evidenceCount: best.positiveCount,
        sampleEvidence: posEvidence.rows.map(row => ({
          reviewId: row.id,
          property: row.property_name,
          date: row.review_date,
          rating: row.rating,
          quote: row.full_text,
        })),
      });
    }

    return insights;
  }

  /**
   * Returns all supporting evidence reviews for a given insight ID.
   */
  async getInsightEvidence(insightId, options = {}) {
    const pool = options.poolOverride || dbConn.getPool();
    if (!pool) return [];

    const all = await this.getInsights(options);
    const matched = all.find(i => i.id === insightId);
    if (!matched) return [];

    const sentiment = matched.type === 'operational_strength' ? 'positive' : 'negative';

    const res = await pool.query(`
      SELECT 
        r.id,
        r.rating,
        r.review_date,
        r.positive_text,
        r.negative_text,
        r.full_text,
        r.reviewer_country,
        p.name as property_name,
        p.property_code
      FROM review_topics t
      JOIN reviews r ON t.review_id = r.id
      JOIN properties p ON r.property_id = p.id
      WHERE t.topic_name = $1 AND t.topic_sentiment = $2
      ORDER BY r.review_date DESC
      LIMIT 50;
    `, [matched.category, sentiment]);

    return res.rows;
  }
}

module.exports = new InsightsEngine();

