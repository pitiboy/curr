import type {
  EggInventoryKpis,
  EggMemberRow,
  EggTimeseriesPoint,
} from './types';

/** Produced EGG in one timeseries bucket (sum across aloms). */
export function producedInPeriod(point: EggTimeseriesPoint): number {
  return Object.values(point.byAlom).reduce((sum, n) => sum + n, 0);
}

/** Mean produced quantity per chart bucket in the selected range. */
export function averageProducedPerBucket(
  timeseries: readonly EggTimeseriesPoint[],
): number | null {
  if (timeseries.length === 0) return null;
  const total = timeseries.reduce(
    (sum, point) => sum + producedInPeriod(point),
    0,
  );
  return total / timeseries.length;
}

/** Per-alom mean production per chart bucket (daily / monthly per preset). */
export function alomProducedDailyAverage(
  produced: number,
  bucketCount: number,
): number | null {
  if (bucketCount === 0) return null;
  return produced / bucketCount;
}

/**
 * Ordinary least-squares trend line through equally spaced buckets (x = 0..n-1).
 * Returns null when a line is undefined (fewer than two points).
 * Values are clamped to ≥ 0 to match the chart y-axis.
 */
export function linearTrendSeries(values: readonly number[]): number[] | null {
  const n = values.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    const y = values[i] ?? 0;
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumXX += i * i;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return Array.from({ length: n }, (_, i) =>
    Math.max(0, intercept + slope * i),
  );
}

export function memberTotal(
  row: Pick<EggMemberRow, 'internalQty' | 'saleQty'>,
): number {
  return row.internalQty + row.saleQty;
}

export function buildKpis(
  produced: number,
  internalTotal: number,
  saleTotal: number,
): EggInventoryKpis {
  const distributed = internalTotal + saleTotal;
  return {
    produced,
    distributed,
    remaining: produced - distributed,
    internalTotal,
    saleTotal,
  };
}

export function sortMembersByTotal(rows: EggMemberRow[]): EggMemberRow[] {
  return [...rows]
    .filter((row) => memberTotal(row) > 0)
    .sort((a, b) => memberTotal(b) - memberTotal(a));
}
