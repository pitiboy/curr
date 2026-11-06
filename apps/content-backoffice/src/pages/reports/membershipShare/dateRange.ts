import type { DateRangePreset } from './types';

export type DateRangeBounds = {
  /** Inclusive YYYY-MM-DD, or null for open start (all time). */
  from: string | null;
  /** Inclusive YYYY-MM-DD. */
  to: string;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local-calendar bounds for a report preset (not UTC). */
export function boundsForPreset(
  preset: DateRangePreset,
  now = new Date(),
): DateRangeBounds {
  const to = toIsoDate(now);
  switch (preset) {
    case 'all':
      return { from: null, to };
    case 'thisYear': {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: toIsoDate(from), to };
    }
    case 'thisMonth': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toIsoDate(from), to };
    }
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toIsoDate(from), to: toIsoDate(end) };
    }
    case 'last7': {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: toIsoDate(from), to };
    }
    default:
      return { from: null, to };
  }
}

/** Bucket key for charts: month for long ranges, day otherwise. */
export function periodKeyForPreset(
  isoDate: string,
  preset: DateRangePreset,
): string {
  const day = isoDate.slice(0, 10);
  if (preset === 'all' || preset === 'thisYear') {
    return day.slice(0, 7);
  }
  return day;
}
