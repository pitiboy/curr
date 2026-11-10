import {
  periodKeyForPreset,
  periodsInRange,
  type DateRangeBounds,
} from '../shared/reportDateRange';
import type {
  DateRangePreset,
  FlockAlomRow,
  FlockAnimal,
  FlockCounts,
  FlockMovementKind,
  FlockTimeseriesPoint,
  PoultryFlockKpis,
  PoultryFlockReport,
} from './types';
import {
  FLOCK_CURRENCY_HEN,
  FLOCK_CURRENCY_ROOSTER,
  FLOCK_MEMBER_PRIVATE_ACCOUNT_CODE,
  FLOCK_MORTALITY_ACCOUNT_CODE,
  FLOCK_STOCK_ACCOUNT_CODE,
} from './types';

export type FlockReportTx = {
  date: string;
  amount: number;
  currencyCode: string;
  debitCode: string;
  creditCode: string;
  debitAccountName?: string;
  orgId: string;
  orgName: string;
};

export type FlockReportCatalog = {
  /** Hen-house org id → alom display name (children of Tyúktartás). */
  henHouseNames: ReadonlyMap<string, string>;
};

export function animalForCurrency(code: string): FlockAnimal | null {
  if (code === FLOCK_CURRENCY_HEN) return 'hen';
  if (code === FLOCK_CURRENCY_ROOSTER) return 'rooster';
  return null;
}

/** Signed headcount change on 1300 and its movement kind; null when unrelated. */
export function classifyFlockTx(
  tx: FlockReportTx,
): { delta: number; kind: FlockMovementKind } | null {
  const debitStock = tx.debitCode === FLOCK_STOCK_ACCOUNT_CODE;
  const creditStock = tx.creditCode === FLOCK_STOCK_ACCOUNT_CODE;
  if (debitStock === creditStock) return null;
  if (debitStock) return { delta: tx.amount, kind: 'added' };
  if (tx.debitCode === FLOCK_MORTALITY_ACCOUNT_CODE) {
    return { delta: -tx.amount, kind: 'died' };
  }
  const debitName = tx.debitAccountName?.toLowerCase() ?? '';
  if (
    tx.debitCode === FLOCK_MEMBER_PRIVATE_ACCOUNT_CODE ||
    debitName.includes('saját')
  ) {
    return { delta: -tx.amount, kind: 'slaughtered' };
  }
  return { delta: -tx.amount, kind: 'otherOut' };
}

function emptyCounts(): FlockCounts {
  return { hen: 0, rooster: 0, total: 0 };
}

function bump(counts: FlockCounts, animal: FlockAnimal, qty: number): void {
  counts[animal] += qty;
  counts.total += qty;
}

type AlomAcc = {
  opening: number;
  added: number;
  died: number;
  slaughtered: number;
  otherOut: number;
  closingHen: number;
  closingRooster: number;
};

function emptyAlom(): AlomAcc {
  return {
    opening: 0,
    added: 0,
    died: 0,
    slaughtered: 0,
    otherOut: 0,
    closingHen: 0,
    closingRooster: 0,
  };
}

/**
 * Build the flock report. `txs` should contain every relevant movement up to
 * `bounds.to` (also before `bounds.from`, for the opening headcount).
 * Returns null when there is neither headcount nor movement.
 */
export function aggregatePoultryFlockReport(
  txs: readonly FlockReportTx[],
  catalog: FlockReportCatalog,
  preset: DateRangePreset,
  bounds: DateRangeBounds,
): PoultryFlockReport | null {
  const kpis: PoultryFlockKpis = {
    opening: emptyCounts(),
    added: emptyCounts(),
    died: emptyCounts(),
    slaughtered: emptyCounts(),
    otherOut: emptyCounts(),
    closing: emptyCounts(),
  };
  const alomAcc = new Map<string, AlomAcc>();
  const ensureAlom = (name: string): AlomAcc => {
    let acc = alomAcc.get(name);
    if (!acc) {
      acc = emptyAlom();
      alomAcc.set(name, acc);
    }
    return acc;
  };
  for (const name of catalog.henHouseNames.values()) ensureAlom(name);

  /** period → alom → { hen, rooster } signed delta inside the range. */
  const deltaByPeriod = new Map<string, Map<string, FlockCounts>>();
  const movementsByPeriod = new Map<
    string,
    Record<FlockMovementKind, number>
  >();

  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  let firstInRangeDay: string | null = null;
  let relevantCount = 0;

  for (const tx of sorted) {
    const animal = animalForCurrency(tx.currencyCode);
    if (!animal) continue;
    const move = classifyFlockTx(tx);
    if (!move || move.delta === 0) continue;
    const day = tx.date.slice(0, 10);
    if (day > bounds.to) continue;
    relevantCount += 1;

    const alomName = (catalog.henHouseNames.get(tx.orgId) ?? tx.orgName) || '—';
    const acc = ensureAlom(alomName);
    if (animal === 'hen') acc.closingHen += move.delta;
    else acc.closingRooster += move.delta;
    bump(kpis.closing, animal, move.delta);

    if (bounds.from && day < bounds.from) {
      acc.opening += move.delta;
      bump(kpis.opening, animal, move.delta);
      continue;
    }

    if (firstInRangeDay == null) firstInRangeDay = day;
    const qty = Math.abs(move.delta);
    acc[move.kind] += qty;
    bump(kpis[move.kind], animal, qty);

    const period = periodKeyForPreset(day, preset);
    let alomDeltas = deltaByPeriod.get(period);
    if (!alomDeltas) {
      alomDeltas = new Map();
      deltaByPeriod.set(period, alomDeltas);
    }
    const cell = alomDeltas.get(alomName) ?? emptyCounts();
    bump(cell, animal, move.delta);
    alomDeltas.set(alomName, cell);

    const moves = movementsByPeriod.get(period) ?? {
      added: 0,
      died: 0,
      slaughtered: 0,
      otherOut: 0,
    };
    moves[move.kind] += qty;
    movementsByPeriod.set(period, moves);
  }

  if (relevantCount === 0) return null;

  const alomNames = [...alomAcc.entries()]
    .filter(
      ([, acc]) =>
        acc.opening !== 0 ||
        acc.added !== 0 ||
        acc.died !== 0 ||
        acc.slaughtered !== 0 ||
        acc.otherOut !== 0 ||
        acc.closingHen !== 0 ||
        acc.closingRooster !== 0,
    )
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, 'hu'));

  const byAlom: FlockAlomRow[] = alomNames.map((alomName) => {
    const acc = alomAcc.get(alomName) ?? emptyAlom();
    const base = acc.opening + acc.added;
    return {
      alomName,
      opening: acc.opening,
      added: acc.added,
      died: acc.died,
      slaughtered: acc.slaughtered,
      otherOut: acc.otherOut,
      closing: acc.closingHen + acc.closingRooster,
      closingHen: acc.closingHen,
      closingRooster: acc.closingRooster,
      mortalityRate: base > 0 ? acc.died / base : null,
    };
  });

  // Running headcount per alom, starting from the opening balance.
  const running = new Map<string, FlockCounts>();
  for (const name of alomNames) {
    const acc = alomAcc.get(name) ?? emptyAlom();
    const deltas = emptyCounts();
    for (const moves of deltaByPeriod.values()) {
      const cell = moves.get(name);
      if (!cell) continue;
      deltas.hen += cell.hen;
      deltas.rooster += cell.rooster;
    }
    const hen = acc.closingHen - deltas.hen;
    const rooster = acc.closingRooster - deltas.rooster;
    running.set(name, { hen, rooster, total: hen + rooster });
  }

  const periods = periodsInRange(preset, bounds, firstInRangeDay ?? bounds.to);

  const timeseries: FlockTimeseriesPoint[] = periods.map((period) => {
    const deltas = deltaByPeriod.get(period);
    const headcountByAlom: Record<string, number> = {};
    const headcount = emptyCounts();
    for (const name of alomNames) {
      const current = running.get(name) ?? emptyCounts();
      const cell = deltas?.get(name);
      if (cell) {
        current.hen += cell.hen;
        current.rooster += cell.rooster;
        current.total = current.hen + current.rooster;
        running.set(name, current);
      }
      headcountByAlom[name] = current.total;
      headcount.hen += current.hen;
      headcount.rooster += current.rooster;
    }
    headcount.total = headcount.hen + headcount.rooster;
    const moves = movementsByPeriod.get(period);
    return {
      period,
      headcountByAlom,
      headcount,
      added: moves?.added ?? 0,
      died: moves?.died ?? 0,
      slaughtered: moves?.slaughtered ?? 0,
      otherOut: moves?.otherOut ?? 0,
    };
  });

  return { kpis, alomNames, timeseries, byAlom };
}
