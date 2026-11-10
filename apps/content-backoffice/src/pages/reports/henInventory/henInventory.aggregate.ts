import {
  HEN_INVENTORY_ACCOUNT_CODE,
  HEN_MEMBER_PRIVATE_ACCOUNT_CODE,
  HEN_MORTALITY_EXPENSE_ACCOUNT_CODE,
  HEN_SLAUGHTER_DESCRIPTION_RE,
  HEN_TRANSFER_DESCRIPTION_RE,
  isPoultryInventoryCurrency,
} from './henInventory.constants';
import {
  boundsForPreset,
  endDateOfPeriod,
  periodKeyForPreset,
  periodsInRange,
  type DateRangeBounds,
  type DateRangePreset,
} from '../shared/reportDateRange';
import type {
  HenAlomRow,
  HenInventoryReport,
  HenMemberOutflowRow,
  HenOutflowTimeseriesPoint,
  HenStockTimeseriesPoint,
} from './types';

export type HenReportTx = {
  date: string;
  amount: number;
  currencyCode: string;
  debitCode: string;
  creditCode: string;
  debitAccountId: string;
  debitAccountName?: string;
  orgId: string;
  orgName: string;
  description?: string;
};

export type HenReportMemberRef = {
  memberId: string;
  memberName: string;
  privateAccountId: string | null;
  privateAccountCode: string | null;
};

export type HenReportCatalog = {
  henHouseIds: ReadonlySet<string>;
  henHouseNames: ReadonlyMap<string, string>;
  /** Tyúktartás — member outflows are sometimes booked on the parent org. */
  poultryParentOrgId: string | null;
  members: readonly HenReportMemberRef[];
};

function normalizeDate(raw: string): string {
  return raw.slice(0, 10);
}

function inventoryDelta(
  tx: HenReportTx,
  henHouseIds: ReadonlySet<string>,
): number {
  if (!isPoultryInventoryCurrency(tx.currencyCode)) return 0;
  if (!henHouseIds.has(tx.orgId)) return 0;
  if (tx.debitCode === HEN_INVENTORY_ACCOUNT_CODE) return tx.amount;
  if (tx.creditCode === HEN_INVENTORY_ACCOUNT_CODE) return -tx.amount;
  return 0;
}

function isMortality(
  tx: HenReportTx,
  henHouseIds: ReadonlySet<string>,
): boolean {
  return (
    isPoultryInventoryCurrency(tx.currencyCode) &&
    henHouseIds.has(tx.orgId) &&
    tx.debitCode === HEN_MORTALITY_EXPENSE_ACCOUNT_CODE &&
    tx.creditCode === HEN_INVENTORY_ACCOUNT_CODE
  );
}

function looksLikeMemberPrivateDebit(tx: HenReportTx): boolean {
  if (tx.debitCode === HEN_MEMBER_PRIVATE_ACCOUNT_CODE) return true;
  const name = tx.debitAccountName?.toLowerCase() ?? '';
  return name.includes('saját');
}

function isPoultryOrg(
  tx: HenReportTx,
  henHouseIds: ReadonlySet<string>,
  poultryParentOrgId: string | null,
): boolean {
  return (
    henHouseIds.has(tx.orgId) ||
    (poultryParentOrgId != null && tx.orgId === poultryParentOrgId)
  );
}

function isMemberInventoryOutflow(
  tx: HenReportTx,
  catalog: Pick<HenReportCatalog, 'henHouseIds' | 'poultryParentOrgId'>,
): boolean {
  return (
    isPoultryInventoryCurrency(tx.currencyCode) &&
    isPoultryOrg(tx, catalog.henHouseIds, catalog.poultryParentOrgId) &&
    tx.creditCode === HEN_INVENTORY_ACCOUNT_CODE &&
    looksLikeMemberPrivateDebit(tx)
  );
}

function isSlaughter(tx: HenReportTx): boolean {
  const desc = tx.description ?? '';
  if (HEN_TRANSFER_DESCRIPTION_RE.test(desc)) return false;
  return HEN_SLAUGHTER_DESCRIPTION_RE.test(desc);
}

function memberLabelFromDebit(tx: HenReportTx): string {
  const name = tx.debitAccountName?.trim() ?? '';
  const match = name.match(/^(.+?)\s+-\s+saját/i);
  if (match?.[1]) return match[1].trim();
  return tx.debitCode || 'Ismeretlen tag';
}

function inSelectedPeriod(
  day: string,
  bounds: ReturnType<typeof boundsForPreset>,
): boolean {
  if (day > bounds.to) return false;
  if (bounds.from && day < bounds.from) return false;
  return true;
}

export function aggregateHenInventoryReport(
  txs: readonly HenReportTx[],
  catalog: HenReportCatalog,
  preset: DateRangePreset,
  now = new Date(),
  /** Explicit range (custom dates); defaults to the preset's bounds. */
  explicitBounds?: DateRangeBounds,
): HenInventoryReport | null {
  const bounds = explicitBounds ?? boundsForPreset(preset, now);
  const sorted = [...txs].sort((a, b) =>
    normalizeDate(a.date).localeCompare(normalizeDate(b.date)),
  );

  const memberByPrivateId = new Map<string, HenReportMemberRef>();
  for (const m of catalog.members) {
    if (m.privateAccountId) memberByPrivateId.set(m.privateAccountId, m);
  }

  const balanceByOrg = new Map<string, number>();
  for (const id of catalog.henHouseIds) {
    balanceByOrg.set(id, 0);
  }

  const alomIntake = new Map<string, number>();
  const alomMortality = new Map<string, number>();

  let slaughterInPeriod = 0;
  let transferInPeriod = 0;
  let mortalityInPeriod = 0;
  let intakeInPeriod = 0;

  const slaughterByPeriod = new Map<string, Map<string, number>>();
  const transferByPeriod = new Map<string, Map<string, number>>();
  const memberTotals = new Map<
    string,
    {
      memberName: string;
      accountLabel: string;
      slaughter: number;
      transfer: number;
    }
  >();

  const ensureMemberRow = (
    memberId: string,
    memberName: string,
    accountLabel: string,
  ) => {
    let row = memberTotals.get(memberId);
    if (!row) {
      row = { memberName, accountLabel, slaughter: 0, transfer: 0 };
      memberTotals.set(memberId, row);
    }
    return row;
  };

  const bumpOutflow = (
    map: Map<string, Map<string, number>>,
    period: string,
    memberId: string,
    qty: number,
  ) => {
    let inner = map.get(period);
    if (!inner) {
      inner = new Map();
      map.set(period, inner);
    }
    inner.set(memberId, (inner.get(memberId) ?? 0) + qty);
  };

  let earliestDay: string | null = null;

  for (const tx of sorted) {
    const day = normalizeDate(tx.date);
    if (!earliestDay || day < earliestDay) earliestDay = day;

    if (!inSelectedPeriod(day, bounds)) continue;

    const alomName = (catalog.henHouseNames.get(tx.orgId) ?? tx.orgName) || '—';

    if (
      isPoultryInventoryCurrency(tx.currencyCode) &&
      catalog.henHouseIds.has(tx.orgId) &&
      tx.debitCode === HEN_INVENTORY_ACCOUNT_CODE &&
      tx.creditCode !== HEN_MEMBER_PRIVATE_ACCOUNT_CODE
    ) {
      intakeInPeriod += tx.amount;
      if (catalog.henHouseIds.has(tx.orgId)) {
        alomIntake.set(alomName, (alomIntake.get(alomName) ?? 0) + tx.amount);
      }
    }

    if (isMortality(tx, catalog.henHouseIds)) {
      mortalityInPeriod += tx.amount;
      alomMortality.set(
        alomName,
        (alomMortality.get(alomName) ?? 0) + tx.amount,
      );
    }

    if (!isMemberInventoryOutflow(tx, catalog)) continue;

    const ref = memberByPrivateId.get(tx.debitAccountId);
    const memberId =
      ref?.memberId ?? `acct:${tx.debitAccountId || tx.debitCode}`;
    const memberName = ref?.memberName ?? memberLabelFromDebit(tx);
    const accountLabel = ref
      ? `${ref.privateAccountCode ?? HEN_MEMBER_PRIVATE_ACCOUNT_CODE} · ${ref.memberName}`
      : `${tx.debitCode || '—'} · ${memberName}`;
    const row = ensureMemberRow(memberId, memberName, accountLabel);
    const period = periodKeyForPreset(day, preset);

    // Kimutatásban az átadás minden tagi készletkivét (a levágás sablon is).
    transferInPeriod += tx.amount;
    row.transfer += tx.amount;
    bumpOutflow(transferByPeriod, period, memberId, tx.amount);

    if (isSlaughter(tx)) {
      slaughterInPeriod += tx.amount;
      row.slaughter += tx.amount;
      bumpOutflow(slaughterByPeriod, period, memberId, tx.amount);
    }
  }

  for (const tx of sorted) {
    const delta = inventoryDelta(tx, catalog.henHouseIds);
    if (delta !== 0) {
      balanceByOrg.set(tx.orgId, (balanceByOrg.get(tx.orgId) ?? 0) + delta);
    }
  }

  const hasStock = [...balanceByOrg.values()].some((n) => n !== 0);
  const hasFlow =
    slaughterInPeriod > 0 ||
    transferInPeriod > 0 ||
    mortalityInPeriod > 0 ||
    intakeInPeriod > 0;

  if (!hasStock && !hasFlow) return null;

  const fallbackFrom = earliestDay ?? bounds.to;
  const periodList = periodsInRange(preset, bounds, fallbackFrom);

  const alomNames = [...catalog.henHouseNames.values()].sort((a, b) =>
    a.localeCompare(b, 'hu'),
  );

  const stockTimeseries = buildStockTimeseries(
    sorted,
    catalog,
    preset,
    periodList,
    alomNames,
  );

  const outflowTimeseries: HenOutflowTimeseriesPoint[] = periodList.map(
    (period) => ({
      period,
      slaughterByMember: Object.fromEntries(
        slaughterByPeriod.get(period) ?? [],
      ),
      transferByMember: Object.fromEntries(transferByPeriod.get(period) ?? []),
    }),
  );

  let totalStock = 0;
  const byAlom: HenAlomRow[] = alomNames.map((alomName) => {
    const orgEntry = [...catalog.henHouseNames.entries()].find(
      ([, n]) => n === alomName,
    );
    const stockEnd = orgEntry ? (balanceByOrg.get(orgEntry[0]) ?? 0) : 0;
    totalStock += stockEnd;
    return {
      alomName,
      stockEnd,
      intake: alomIntake.get(alomName) ?? 0,
      mortality: alomMortality.get(alomName) ?? 0,
    };
  });

  const byMember: HenMemberOutflowRow[] = [...memberTotals.entries()]
    .map(([memberId, row]) => ({
      memberId,
      memberName: row.memberName,
      accountLabel: row.accountLabel,
      slaughterQty: row.slaughter,
      transferQty: row.transfer,
    }))
    .filter((r) => r.transferQty > 0)
    .sort((a, b) => b.transferQty - a.transferQty);

  return {
    kpis: {
      totalStock,
      slaughterInPeriod,
      transferInPeriod,
      mortalityInPeriod,
      intakeInPeriod,
    },
    stockTimeseries,
    byAlom,
    outflowTimeseries,
    byMember,
  };
}

function buildStockTimeseries(
  sorted: readonly HenReportTx[],
  catalog: HenReportCatalog,
  preset: DateRangePreset,
  periodList: readonly string[],
  alomNames: readonly string[],
): HenStockTimeseriesPoint[] {
  const balanceByOrg = new Map<string, number>();
  for (const id of catalog.henHouseIds) {
    balanceByOrg.set(id, 0);
  }

  let txIndex = 0;
  return periodList.map((period) => {
    const endDay = endDateOfPeriod(period, preset);
    while (txIndex < sorted.length) {
      const tx = sorted[txIndex]!;
      const day = normalizeDate(tx.date);
      if (day > endDay) break;
      const delta = inventoryDelta(tx, catalog.henHouseIds);
      if (delta !== 0) {
        balanceByOrg.set(tx.orgId, (balanceByOrg.get(tx.orgId) ?? 0) + delta);
      }
      txIndex += 1;
    }
    const byAlom: Record<string, number> = {};
    for (const name of alomNames) {
      const orgEntry = [...catalog.henHouseNames.entries()].find(
        ([, n]) => n === name,
      );
      byAlom[name] = orgEntry ? (balanceByOrg.get(orgEntry[0]) ?? 0) : 0;
    }
    return { period, byAlom };
  });
}

export function reportHasActivity(report: HenInventoryReport): boolean {
  return (
    report.kpis.totalStock > 0 ||
    report.kpis.slaughterInPeriod > 0 ||
    report.kpis.transferInPeriod > 0 ||
    report.kpis.intakeInPeriod > 0
  );
}
