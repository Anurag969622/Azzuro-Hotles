'use strict';

/**
 * Operational Priority Engine
 * 
 * Develops a transparent heuristic for operational hotel priorities using:
 * 1. Complaint Frequency (Volume of negative reviews on this topic)
 * 2. Severity (Impact based on average guest rating when this complaint occurs)
 * 3. Trend Change (Acceleration: current period volume vs previous period volume)
 * 4. Property Concentration (Whether concentrated in a specific hotel property)
 * 
 * Formula:
 * PriorityScore = (NormalizedFrequency * 0.35) +
 *                 (SeverityFactor * 0.30) +
 *                 (TrendMultiplier * 0.20) +
 *                 (ConcentrationRatio * 0.15)
 * Scaled to 0 - 100.
 */

function calculatePriorityScore({
  topicName,
  negativeCount,
  totalNegativeReviews,
  avgRatingForTopic,
  prevNegativeCount = 0,
  maxPropertyCount = 0,
}) {
  if (!negativeCount || totalNegativeReviews === 0) {
    return {
      score: 0,
      level: 'Low',
      breakdown: { frequency: 0, severity: 0, trend: 0, concentration: 0 },
    };
  }

  // 1. Normalized Frequency (0 - 100): share of total complaints
  const frequencyRatio = negativeCount / totalNegativeReviews;
  const frequencyScore = Math.min(100, frequencyRatio * 150);

  // 2. Severity Factor (0 - 100): lower rating = higher severity
  // Ratings for complaints usually range 1.0 - 6.0
  const normalizedRating = Math.max(0, Math.min(10, avgRatingForTopic || 5.0));
  const severityScore = Math.max(0, (10 - normalizedRating) * 10);

  // 3. Trend Multiplier (0 - 100): change vs previous period
  let trendScore = 50; // base neutral trend
  if (prevNegativeCount > 0) {
    const growth = (negativeCount - prevNegativeCount) / prevNegativeCount;
    trendScore = Math.max(0, Math.min(100, 50 + growth * 50));
  } else if (negativeCount > 0) {
    trendScore = 70; // new emergence
  }

  // 4. Concentration Ratio (0 - 100): if one property accounts for most complaints
  const concentrationRatio = negativeCount > 0 ? (maxPropertyCount / negativeCount) : 0;
  const concentrationScore = Math.min(100, concentrationRatio * 100);

  // Weighted sum
  const rawScore = (frequencyScore * 0.35) +
                   (severityScore * 0.30) +
                   (trendScore * 0.20) +
                   (concentrationScore * 0.15);

  const finalScore = Math.round(Math.min(100, Math.max(0, rawScore)));

  let level = 'Low';
  if (finalScore >= 75) level = 'Critical';
  else if (finalScore >= 55) level = 'High';
  else if (finalScore >= 35) level = 'Medium';

  return {
    score: finalScore,
    level,
    breakdown: {
      frequencyRatio: Math.round(frequencyRatio * 1000) / 10, // percentage
      severityAvgRating: Math.round(normalizedRating * 10) / 10,
      trendChangePercent: prevNegativeCount > 0
        ? Math.round(((negativeCount - prevNegativeCount) / prevNegativeCount) * 100)
        : 100,
      concentrationPercent: Math.round(concentrationRatio * 100),
      formula: 'Priority = (Frequency*0.35) + (Severity*0.30) + (Trend*0.20) + (Concentration*0.15)',
    },
  };
}

module.exports = {
  calculatePriorityScore,
};

