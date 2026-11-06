import type { EggInventoryKpis, EggMemberRow } from './types';

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
