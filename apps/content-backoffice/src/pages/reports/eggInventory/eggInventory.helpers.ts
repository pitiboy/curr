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
