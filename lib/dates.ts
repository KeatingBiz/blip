// lib/dates.ts
const DEFAULT_TZ = process.env.BLIP_TZ || 'America/Chicago';

/** YYYY-MM-DD for a specific timezone (not UTC). */
export function todayKeyTZ(tz: string = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}
