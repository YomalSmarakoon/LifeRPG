import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { getISOWeek, getISOWeekYear, addDays } from 'date-fns';

export function toDateKey(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

export function toWeekKey(date: Date, timezone: string): string {
  const local = toZonedTime(date, timezone);
  const year = getISOWeekYear(local);
  const week = getISOWeek(local);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// Returns "YYYY-MM-DD" of Monday of the given ISO week in the user's timezone.
// weekKey format: "2026-W25"
export function weekStartDateKey(weekKey: string, timezone: string): string {
  const [yearStr, weekPart] = weekKey.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);

  // Find Jan 4th (always in week 1 by ISO 8601), then walk to the right week
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Local = toZonedTime(jan4, timezone);
  // Day of week: 0=Sun,1=Mon...6=Sat; ISO: Mon=1
  const dow = jan4Local.getDay() === 0 ? 7 : jan4Local.getDay();
  // Monday of week 1
  const week1Monday = addDays(jan4Local, 1 - dow);
  // Monday of target week
  const targetMonday = addDays(week1Monday, (week - 1) * 7);
  return formatInTimeZone(targetMonday, timezone, 'yyyy-MM-dd');
}

// Calendar day difference between two dateKeys ("YYYY-MM-DD").
// Returns null if either is null.
export function calendarDaysBetween(
  fromKey: string | null,
  toKey: string,
): number | null {
  if (fromKey === null) return null;
  const from = new Date(`${fromKey}T00:00:00Z`);
  const to = new Date(`${toKey}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function previousDayKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
