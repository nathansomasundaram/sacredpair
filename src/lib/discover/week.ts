/** Every member gets this many introductions a week. */
export const INTRODUCTIONS_PER_WEEK = 4;

/** Adds days to a YYYY-MM-DD date, staying in plain calendar dates. */
export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
