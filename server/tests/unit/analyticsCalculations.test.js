import { describe, it, expect } from 'vitest';
import { getReportingPeriods } from '../../src/modules/analytics/dateUtils';
import { calculatePriorityScore } from '../../src/modules/analytics/priorityEngine';

describe('Analytics Date & Period Calculations', () => {
  it('correctly calculates Sydney reporting periods starting on Monday', () => {
    // Test with a known Wednesday: 2026-11-18
    const periods = getReportingPeriods('2026-11-18T12:00:00Z');

    expect(periods.timezone).toBe('Australia/Sydney');
    // Monday of this week: 2026-11-16
    expect(periods.currentWeek.startDate).toBe('2026-11-16');
    // Previous week equivalent start (Monday): 2026-11-09
    expect(periods.previousWeekEquivalent.startDate).toBe('2026-11-09');
  });
});

describe('Operational Priority Score Engine', () => {
  it('computes transparent weighted priority score with breakdown', () => {
    const priority = calculatePriorityScore({
      topicName: 'Cleanliness',
      negativeCount: 15,
      totalNegativeReviews: 30, // 50% frequency
      avgRatingForTopic: 3.5,   // severe
      prevNegativeCount: 10,    // 50% growth
      maxPropertyCount: 12,     // 80% concentrated in one hotel
    });

    expect(priority.score).toBeGreaterThanOrEqual(0);
    expect(priority.score).toBeLessThanOrEqual(100);
    expect(['Critical', 'High', 'Medium', 'Low']).toContain(priority.level);
    expect(priority.breakdown.frequencyRatio).toBe(50);
    expect(priority.breakdown.severityAvgRating).toBe(3.5);
    expect(priority.breakdown.formula).toBeDefined();
  });

  it('assigns Low priority when no negative reviews exist for topic', () => {
    const priority = calculatePriorityScore({
      topicName: 'Location',
      negativeCount: 0,
      totalNegativeReviews: 20,
      avgRatingForTopic: 9.0,
    });

    expect(priority.score).toBe(0);
    expect(priority.level).toBe('Low');
  });
});

