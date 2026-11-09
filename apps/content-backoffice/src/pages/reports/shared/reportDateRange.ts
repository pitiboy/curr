export type DateRangePreset =
  'all' | 'thisMonth' | 'lastMonth' | 'last7' | 'thisYear';

export const REPORT_RANGE_PRESETS: readonly DateRangePreset[] = [
  'all',
  'thisMonth',
  'lastMonth',
  'last7',
  'thisYear',
] as const;

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

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addPeriodStep(iso: string, preset: DateRangePreset): string {
  const d = parseIsoLocal(iso);
  if (preset === 'all' || preset === 'thisYear') {
    d.setMonth(d.getMonth() + 1);
    return toIsoDate(d).slice(0, 7);
  }
  d.setDate(d.getDate() + 1);
  return toIsoDate(d);
}

/**
 * Sorted period bucket keys covering [from, to] inclusive.
 * When `from` is null, uses `fallbackFrom` (e.g. first ledger activity).
 */
export function periodsInRange(
  preset: DateRangePreset,
  bounds: DateRangeBounds,
  fallbackFrom: string,
): string[] {
  const start = bounds.from ?? fallbackFrom;
  const endKey = periodKeyForPreset(bounds.to, preset);
  const startKey = periodKeyForPreset(start, preset);
  const out: string[] = [];
  let cursor = startKey;
  let guard = 0;
  while (cursor <= endKey && guard < 5000) {
    out.push(cursor);
    if (cursor === endKey) break;
    cursor = addPeriodStep(cursor, preset);
    guard += 1;
  }
  return out;
}
