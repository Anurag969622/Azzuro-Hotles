'use strict';

/**
 * Timezone & Reporting Period Utility
 * Timezone: Australia/Sydney
 * Week starts on: Monday
 */

const SYDNEY_TZ = 'Australia/Sydney';

/**
 * Returns a Date object representing the current moment formatted in Sydney timezone components.
 */
function getSydneyNow() {
  const now = new Date();
  const sydneyString = now.toLocaleString('en-US', { timeZone: SYDNEY_TZ });
  return new Date(sydneyString);
}

/**
 * Formats a Date to YYYY-MM-DD string.
 */
function toDateStr(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns date ranges for:
 * 1. Current week (from Monday up to current elapsed day)
 * 2. Previous week (equivalent elapsed period from previous Monday)
 * 3. Full previous week (Monday to Sunday)
 */
function getReportingPeriods(referenceDate = null) {
  const sydneyDate = referenceDate ? new Date(referenceDate) : getSydneyNow();

  // Day of week in JS: 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayOfWeek = sydneyDate.getDay();
  // Monday-based offset: Mon = 0, Tue = 1, ..., Sun = 6
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  // Current week Monday
  const currentWeekStart = new Date(sydneyDate);
  currentWeekStart.setDate(sydneyDate.getDate() - daysSinceMonday);
  currentWeekStart.setHours(0, 0, 0, 0);

  // Current elapsed day (today)
  const currentElapsedEnd = new Date(sydneyDate);

  // Previous week Monday
  const prevWeekStart = new Date(currentWeekStart);
  prevWeekStart.setDate(currentWeekStart.getDate() - 7);

  // Equivalent elapsed day in previous week
  const prevWeekElapsedEnd = new Date(prevWeekStart);
  prevWeekElapsedEnd.setDate(prevWeekStart.getDate() + daysSinceMonday);
  prevWeekElapsedEnd.setHours(sydneyDate.getHours(), sydneyDate.getMinutes(), sydneyDate.getSeconds(), sydneyDate.getMilliseconds());

  // Full previous week Sunday end
  const prevWeekFullEnd = new Date(prevWeekStart);
  prevWeekFullEnd.setDate(prevWeekStart.getDate() + 6);
  prevWeekFullEnd.setHours(23, 59, 59, 999);

  return {
    timezone: SYDNEY_TZ,
    daysElapsedInWeek: daysSinceMonday + 1,
    currentWeek: {
      startDate: toDateStr(currentWeekStart),
      endDate: toDateStr(currentElapsedEnd),
    },
    previousWeekEquivalent: {
      startDate: toDateStr(prevWeekStart),
      endDate: toDateStr(prevWeekElapsedEnd),
    },
    previousWeekFull: {
      startDate: toDateStr(prevWeekStart),
      endDate: toDateStr(prevWeekFullEnd),
    },
  };
}

module.exports = {
  SYDNEY_TZ,
  getSydneyNow,
  toDateStr,
  getReportingPeriods,
};

