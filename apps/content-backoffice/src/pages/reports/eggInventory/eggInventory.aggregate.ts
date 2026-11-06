import {
  DISTRIBUTION_INVENTORY_ACCOUNT_CODE,
  DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE,
  DISTRIBUTION_SALE_CASH_ACCOUNT_CODE,
  EGG_PRODUCTION_CREDIT_ACCOUNT_CODE,
  EGG_PRODUCTION_DEBIT_ACCOUNT_CODE,
} from '../../../workflows/bulk-quantity/eggDailyEntry.constants';

import { periodKeyForPreset } from './dateRange';
import {
  buildKpis,
  memberTotal,
  sortMembersByTotal,
} from './eggInventory.helpers';
import type {
  DateRangePreset,
  EggAlomRow,
  EggInventoryReport,
  EggMemberRow,
  EggTimeseriesPoint,
} from './types';

export type EggReportTx = {
  date: string;
  amount: number;
  currencyCode: string;
  debitCode: string;
  creditCode: string;
  debitAccountId: string;
  creditAccountId: string;
  debitAccountName?: string;
  orgId: string;
  orgName: string;
};

export type EggReportMemberRef = {
  memberId: string;
  memberName: string;
  privateAccountId: string | null;
  privateAccountCode: string | null;
};

export type EggReportCatalog = {
  henHouseIds: ReadonlySet<string>;
  henHouseNames: ReadonlyMap<string, string>;
  members: readonly EggReportMemberRef[];
  saleCurrency: string;
};

function normalizeDate(raw: string): string {
  return raw.slice(0, 10);
}

function isProduction(
  tx: EggReportTx,
  henHouseIds: ReadonlySet<string>,
): boolean {
  return (
    tx.currencyCode === 'EGG' &&
    tx.debitCode === EGG_PRODUCTION_DEBIT_ACCOUNT_CODE &&
    tx.creditCode === EGG_PRODUCTION_CREDIT_ACCOUNT_CODE &&
    henHouseIds.has(tx.orgId)
  );
}

function isEggDistribution(tx: EggReportTx): boolean {
  // Member pocket ← inventory. Exclude pool coop-out (4500 ← 1300).
  return (
    tx.currencyCode === 'EGG' &&
    tx.creditCode === DISTRIBUTION_INVENTORY_ACCOUNT_CODE &&
    tx.debitCode !== EGG_PRODUCTION_CREDIT_ACCOUNT_CODE
  );
}

/** Canonical 1001, or saját pocket name when the member map missed the tx. */
function looksLikeMemberPrivateDebit(tx: EggReportTx): boolean {
  if (tx.debitCode === DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE) return true;
  const name = tx.debitAccountName?.toLowerCase() ?? '';
  return name.includes('saját');
}

function memberLabelFromDebit(tx: EggReportTx): string {
  const name = tx.debitAccountName?.trim() ?? '';
  const match = name.match(/^(.+?)\s+-\s+saját/i);
  if (match?.[1]) return match[1].trim();
  return tx.debitCode || 'Ismeretlen tag';
}

function isSaleCashLeg(
  tx: EggReportTx,
  saleCurrency: string,
  memberPrivateIds: ReadonlySet<string>,
): boolean {
  return (
    tx.currencyCode === saleCurrency &&
    tx.debitCode === DISTRIBUTION_SALE_CASH_ACCOUNT_CODE &&
    memberPrivateIds.has(tx.creditAccountId)
  );
}

type MemberAcc = {
  memberId: string;
  memberName: string;
  accountLabel: string;
  internalQty: number;
  saleQty: number;
  saleRevenue: number;
};

/**
 * Build the egg inventory report from published transactions + org/member catalog.
 */
export function aggregateEggInventoryReport(
  txs: readonly EggReportTx[],
  catalog: EggReportCatalog,
  preset: DateRangePreset,
): EggInventoryReport | null {
  const memberByPrivateId = new Map<string, EggReportMemberRef>();
  for (const m of catalog.members) {
    if (m.privateAccountId) {
      memberByPrivateId.set(m.privateAccountId, m);
    }
  }
  const memberPrivateIds = new Set(memberByPrivateId.keys());

  const saleCashByKey = new Map<string, number>();
  for (const tx of txs) {
    if (!isSaleCashLeg(tx, catalog.saleCurrency, memberPrivateIds)) continue;
    const key = `${normalizeDate(tx.date)}|${tx.creditAccountId}`;
    saleCashByKey.set(key, (saleCashByKey.get(key) ?? 0) + tx.amount);
  }
  const saleMemberDayKeys = new Set(saleCashByKey.keys());

  const members = new Map<string, MemberAcc>();
  const ensureMember = (
    memberId: string,
    memberName: string,
    accountLabel: string,
  ): MemberAcc => {
    let row = members.get(memberId);
    if (!row) {
      row = {
        memberId,
        memberName,
        accountLabel,
        internalQty: 0,
        saleQty: 0,
        saleRevenue: 0,
      };
      members.set(memberId, row);
    }
    return row;
  };

  const producedByAlom = new Map<string, number>();
  const producedByPeriodAlom = new Map<string, Map<string, number>>();
  const distInternalByPeriod = new Map<string, number>();
  const distSaleByPeriod = new Map<string, number>();
  const memberTotalByPeriod = new Map<string, Map<string, number>>();

  let produced = 0;
  let internalTotal = 0;
  let saleTotal = 0;

  const bumpPeriodMember = (period: string, memberId: string, qty: number) => {
    let map = memberTotalByPeriod.get(period);
    if (!map) {
      map = new Map();
      memberTotalByPeriod.set(period, map);
    }
    map.set(memberId, (map.get(memberId) ?? 0) + qty);
  };

  for (const tx of txs) {
    const day = normalizeDate(tx.date);
    const period = periodKeyForPreset(day, preset);

    if (isProduction(tx, catalog.henHouseIds)) {
      const alomName =
        (catalog.henHouseNames.get(tx.orgId) ?? tx.orgName) || '—';
      produced += tx.amount;
      producedByAlom.set(
        alomName,
        (producedByAlom.get(alomName) ?? 0) + tx.amount,
      );
      let alomMap = producedByPeriodAlom.get(period);
      if (!alomMap) {
        alomMap = new Map();
        producedByPeriodAlom.set(period, alomMap);
      }
      alomMap.set(alomName, (alomMap.get(alomName) ?? 0) + tx.amount);
      continue;
    }

    if (!isEggDistribution(tx)) continue;

    const ref = memberByPrivateId.get(tx.debitAccountId);
    if (!ref && !looksLikeMemberPrivateDebit(tx)) continue;

    const memberId =
      ref?.memberId ?? `acct:${tx.debitAccountId || tx.debitCode}`;
    const memberName = ref?.memberName ?? memberLabelFromDebit(tx);
    const accountLabel = ref
      ? `${ref.privateAccountCode ?? DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE} · ${ref.memberName}`
      : `${tx.debitCode || '—'} · ${memberName}`;
    const acc = ensureMember(memberId, memberName, accountLabel);

    const cashKey = `${day}|${tx.debitAccountId}`;
    const isSale = saleMemberDayKeys.has(cashKey);

    if (isSale) {
      acc.saleQty += tx.amount;
      saleTotal += tx.amount;
      const cashRevenue = saleCashByKey.get(cashKey);
      if (cashRevenue != null) {
        acc.saleRevenue += cashRevenue;
        // Attribute cash once even if several EGG sale legs share the day.
        saleCashByKey.delete(cashKey);
      }
      distSaleByPeriod.set(
        period,
        (distSaleByPeriod.get(period) ?? 0) + tx.amount,
      );
    } else {
      acc.internalQty += tx.amount;
      internalTotal += tx.amount;
      distInternalByPeriod.set(
        period,
        (distInternalByPeriod.get(period) ?? 0) + tx.amount,
      );
    }
    bumpPeriodMember(period, memberId, tx.amount);
  }

  if (
    produced === 0 &&
    internalTotal === 0 &&
    saleTotal === 0 &&
    members.size === 0
  ) {
    return null;
  }

  const kpis = buildKpis(produced, internalTotal, saleTotal);
  const distributed = kpis.distributed;

  const alomNames = [...producedByAlom.keys()].sort((a, b) =>
    a.localeCompare(b, 'hu'),
  );
  const byAlom: EggAlomRow[] = alomNames.map((alomName) => {
    const p = producedByAlom.get(alomName) ?? 0;
    const d = produced === 0 ? 0 : Math.round((p / produced) * distributed);
    return { alomName, produced: p, distributed: d, remaining: p - d };
  });

  const periodSet = new Set<string>([
    ...producedByPeriodAlom.keys(),
    ...distInternalByPeriod.keys(),
    ...distSaleByPeriod.keys(),
    ...memberTotalByPeriod.keys(),
  ]);
  const periods = [...periodSet].sort();

  const timeseries: EggTimeseriesPoint[] = periods.map((period) => {
    const byAlomPeriod: Record<string, number> = {};
    for (const name of alomNames) {
      byAlomPeriod[name] = producedByPeriodAlom.get(period)?.get(name) ?? 0;
    }
    const byMemberTotal: Record<string, number> = {};
    for (const [memberId, qty] of memberTotalByPeriod.get(period) ?? []) {
      byMemberTotal[memberId] = qty;
    }
    return {
      period,
      byAlom: byAlomPeriod,
      distributedInternal: distInternalByPeriod.get(period) ?? 0,
      distributedSale: distSaleByPeriod.get(period) ?? 0,
      byMemberTotal,
    };
  });

  const byMember: EggMemberRow[] = sortMembersByTotal(
    [...members.values()].map((row) => ({
      ...row,
      saleCurrency: catalog.saleCurrency,
    })),
  );

  return { kpis, timeseries, byAlom, byMember };
}

export function reportHasActivity(report: EggInventoryReport): boolean {
  return (
    report.kpis.produced > 0 ||
    report.kpis.distributed > 0 ||
    report.byMember.some((m) => memberTotal(m) > 0)
  );
}
