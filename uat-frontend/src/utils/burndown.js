const WEEKEND_DAYS = new Set([0, 6]);

const normalizeDate = (date) => {
  const parsed = date instanceof Date ? new Date(date) : new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(12, 0, 0, 0);
  return parsed;
};

const shiftDays = (date, days) => {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
};

const getComparableDate = (date) => {
  const normalized = normalizeDate(date);
  if (!normalized) return null;

  let comparable = normalized;
  while (isWeekend(comparable)) {
    comparable = shiftDays(comparable, -1);
  }

  return comparable;
};

export const isWeekend = (date) => {
  const normalized = normalizeDate(date);
  if (!normalized) return false;
  return WEEKEND_DAYS.has(normalized.getDay());
};

export const getWorkingDaysBetween = (startDate, endDate) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (!start || !end || start > end) return 0;

  let count = 0;
  let cursor = new Date(start);
  while (cursor <= end) {
    if (!isWeekend(cursor)) count += 1;
    cursor = shiftDays(cursor, 1);
  }

  return count;
};

export const getElapsedWorkingDays = (startDate, currentDate) => {
  const start = normalizeDate(startDate);
  const current = getComparableDate(currentDate);
  if (!start || !current || current < start) return 0;

  // Start day is day 0 so ideal starts at 100% on the first working day.
  return Math.max(0, getWorkingDaysBetween(start, current) - 1);
};

export const calculateIdealBurndown = (totalEffort, startDate, endDate, currentDate) => {
  if (!Number.isFinite(totalEffort) || totalEffort <= 0) return 0;

  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  const current = normalizeDate(currentDate);
  if (!start || !end || !current) return totalEffort;
  if (end < start) return totalEffort;
  if (current < start) return totalEffort;

  const comparableCurrent = getComparableDate(current);
  if (!comparableCurrent) return totalEffort;
  if (comparableCurrent >= end) return 0;

  const totalWorkingDays = getWorkingDaysBetween(start, end);
  const elapsedWorkingDays = getElapsedWorkingDays(start, comparableCurrent);
  const denominator = Math.max(1, totalWorkingDays - 1);
  const progress = elapsedWorkingDays / denominator;

  return Math.max(0, Math.round(totalEffort * (1 - progress)));
};
