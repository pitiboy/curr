import type {
  CurrencyAmount,
  DateRangePreset,
  LedgerFocus,
  MembershipHistoryPoint,
  MembershipMemberRow,
  MembershipShareKpis,
  MembershipShareReport,
} from './types';
import {
  MEMBER_POCKET_ACCOUNT_CODE,
  MEMBER_SHARE_ACCOUNT_CODE,
} from './types';

/** Ledger codes used when a real aggregator is wired. */
export const MEMBERSHIP_SHARE_ACCOUNT_CODES = {
  share: MEMBER_SHARE_ACCOUNT_CODE,
  pocket: MEMBER_POCKET_ACCOUNT_CODE,
} as const;

function amountMap(rows: CurrencyAmount[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.currency, (map.get(row.currency) ?? 0) + row.amount);
  }
  return map;
}

export function mergeCurrencyAmounts(
  ...groups: CurrencyAmount[][]
): CurrencyAmount[] {
  const map = new Map<string, number>();
  for (const group of groups) {
    for (const row of group) {
      map.set(row.currency, (map.get(row.currency) ?? 0) + row.amount);
    }
  }
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function memberFocusTotal(
  row: MembershipMemberRow,
  focus: LedgerFocus,
  currency?: string,
): number {
  const parts: CurrencyAmount[][] = [];
  if (focus === 'share' || focus === 'both') parts.push(row.shareByCurrency);
  if (focus === 'pocket' || focus === 'both') parts.push(row.pocketByCurrency);
  const merged = mergeCurrencyAmounts(...parts);
  if (currency) {
    return merged.find((entry) => entry.currency === currency)?.amount ?? 0;
  }
  return merged.reduce((sum, entry) => sum + entry.amount, 0);
}

export function historyAmountForFocus(
  amounts: { share: number; pocket: number },
  focus: LedgerFocus,
): number {
  if (focus === 'share') return amounts.share;
  if (focus === 'pocket') return amounts.pocket;
  return amounts.share + amounts.pocket;
}

export function sortMembersByFocus(
  rows: MembershipMemberRow[],
  focus: LedgerFocus,
): MembershipMemberRow[] {
  return [...rows]
    .filter((row) => memberFocusTotal(row, focus) > 0)
    .sort(
      (a, b) => memberFocusTotal(b, focus) - memberFocusTotal(a, focus),
    );
}

function buildKpis(
  byMember: MembershipMemberRow[],
  paymentCount: number,
): MembershipShareKpis {
  return {
    shareByCurrency: mergeCurrencyAmounts(
      ...byMember.map((row) => row.shareByCurrency),
    ),
    pocketByCurrency: mergeCurrencyAmounts(
      ...byMember.map((row) => row.pocketByCurrency),
    ),
    memberCount: byMember.filter(
      (row) => memberFocusTotal(row, 'both') > 0,
    ).length,
    paymentCount,
  };
}

function assertConsistent(report: MembershipShareReport): MembershipShareReport {
  const { kpis, byMember, history, historyCurrency } = report;
  const shareFromMembers = mergeCurrencyAmounts(
    ...byMember.map((row) => row.shareByCurrency),
  );
  const pocketFromMembers = mergeCurrencyAmounts(
    ...byMember.map((row) => row.pocketByCurrency),
  );
  if (
    JSON.stringify(amountMap(shareFromMembers)) !==
    JSON.stringify(amountMap(kpis.shareByCurrency))
  ) {
    throw new Error('membership-share mock: share KPI mismatch');
  }
  if (
    JSON.stringify(amountMap(pocketFromMembers)) !==
    JSON.stringify(amountMap(kpis.pocketByCurrency))
  ) {
    throw new Error('membership-share mock: pocket KPI mismatch');
  }

  const historyShare = new Map<string, number>();
  const historyPocket = new Map<string, number>();
  for (const point of history) {
    for (const [memberId, amounts] of Object.entries(point.byMember)) {
      historyShare.set(
        memberId,
        (historyShare.get(memberId) ?? 0) + amounts.share,
      );
      historyPocket.set(
        memberId,
        (historyPocket.get(memberId) ?? 0) + amounts.pocket,
      );
    }
  }
  for (const row of byMember) {
    const expectedShare =
      row.shareByCurrency.find((c) => c.currency === historyCurrency)
        ?.amount ?? 0;
    const expectedPocket =
      row.pocketByCurrency.find((c) => c.currency === historyCurrency)
        ?.amount ?? 0;
    if ((historyShare.get(row.memberId) ?? 0) !== expectedShare) {
      throw new Error(
        `membership-share mock: history share mismatch for ${row.memberId}`,
      );
    }
    if ((historyPocket.get(row.memberId) ?? 0) !== expectedPocket) {
      throw new Error(
        `membership-share mock: history pocket mismatch for ${row.memberId}`,
      );
    }
  }

  return report;
}

function members(rows: MembershipMemberRow[]): MembershipMemberRow[] {
  return sortMembersByFocus(rows, 'both');
}

function makeReport(
  rows: MembershipMemberRow[],
  paymentCount: number,
  history: MembershipHistoryPoint[],
  historyCurrency = 'HUF',
): MembershipShareReport {
  const byMember = members(rows);
  return assertConsistent({
    kpis: buildKpis(byMember, paymentCount),
    byMember,
    historyCurrency,
    history,
  });
}

const REPORTS: Record<DateRangePreset, MembershipShareReport | null> = {
  all: makeReport(
    [
      {
        memberId: 'm-peti',
        memberName: 'Peti',
        shareByCurrency: [
          { currency: 'HUF', amount: 1_200_000 },
          { currency: 'EUR', amount: 400 },
        ],
        pocketByCurrency: [{ currency: 'HUF', amount: 85_000 }],
      },
      {
        memberId: 'm-erika',
        memberName: 'Erika',
        shareByCurrency: [{ currency: 'HUF', amount: 980_000 }],
        pocketByCurrency: [
          { currency: 'HUF', amount: 120_000 },
          { currency: 'EUR', amount: 50 },
        ],
      },
      {
        memberId: 'm-anna',
        memberName: 'Anna',
        shareByCurrency: [{ currency: 'HUF', amount: 750_000 }],
        pocketByCurrency: [{ currency: 'HUF', amount: 42_000 }],
      },
      {
        memberId: 'm-gabor',
        memberName: 'Gábor',
        shareByCurrency: [
          { currency: 'HUF', amount: 500_000 },
          { currency: 'EUR', amount: 200 },
        ],
        pocketByCurrency: [{ currency: 'HUF', amount: 18_500 }],
      },
      {
        memberId: 'm-norbi',
        memberName: 'Norbi',
        shareByCurrency: [{ currency: 'HUF', amount: 250_000 }],
        pocketByCurrency: [],
      },
    ],
    47,
    [
      {
        period: '2024-01',
        byMember: {
          'm-peti': { share: 400_000, pocket: 20_000 },
          'm-erika': { share: 300_000, pocket: 30_000 },
          'm-anna': { share: 250_000, pocket: 0 },
        },
      },
      {
        period: '2024-06',
        byMember: {
          'm-peti': { share: 200_000, pocket: 15_000 },
          'm-gabor': { share: 200_000, pocket: 5_000 },
          'm-norbi': { share: 100_000, pocket: 0 },
        },
      },
      {
        period: '2025-01',
        byMember: {
          'm-erika': { share: 280_000, pocket: 40_000 },
          'm-anna': { share: 250_000, pocket: 12_000 },
          'm-gabor': { share: 150_000, pocket: 8_000 },
        },
      },
      {
        period: '2025-06',
        byMember: {
          'm-peti': { share: 300_000, pocket: 25_000 },
          'm-erika': { share: 200_000, pocket: 25_000 },
          'm-norbi': { share: 100_000, pocket: 0 },
        },
      },
      {
        period: '2026-01',
        byMember: {
          'm-peti': { share: 150_000, pocket: 15_000 },
          'm-anna': { share: 150_000, pocket: 18_000 },
          'm-gabor': { share: 100_000, pocket: 5_500 },
        },
      },
      {
        period: '2026-06',
        byMember: {
          'm-peti': { share: 150_000, pocket: 10_000 },
          'm-erika': { share: 200_000, pocket: 25_000 },
          'm-anna': { share: 100_000, pocket: 12_000 },
          'm-gabor': { share: 50_000, pocket: 0 },
          'm-norbi': { share: 50_000, pocket: 0 },
        },
      },
    ],
  ),

  thisMonth: makeReport(
    [
      {
        memberId: 'm-peti',
        memberName: 'Peti',
        shareByCurrency: [{ currency: 'HUF', amount: 150_000 }],
        pocketByCurrency: [{ currency: 'HUF', amount: 12_000 }],
      },
      {
        memberId: 'm-erika',
        memberName: 'Erika',
        shareByCurrency: [{ currency: 'HUF', amount: 100_000 }],
        pocketByCurrency: [{ currency: 'EUR', amount: 20 }],
      },
      {
        memberId: 'm-anna',
        memberName: 'Anna',
        shareByCurrency: [],
        pocketByCurrency: [{ currency: 'HUF', amount: 8_500 }],
      },
      {
        memberId: 'm-gabor',
        memberName: 'Gábor',
        shareByCurrency: [{ currency: 'EUR', amount: 50 }],
        pocketByCurrency: [],
      },
    ],
    9,
    [
      {
        period: '2026-11-03',
        byMember: {
          'm-peti': { share: 80_000, pocket: 0 },
          'm-erika': { share: 50_000, pocket: 0 },
        },
      },
      {
        period: '2026-11-10',
        byMember: {
          'm-peti': { share: 70_000, pocket: 12_000 },
          'm-anna': { share: 0, pocket: 8_500 },
        },
      },
      {
        period: '2026-11-17',
        byMember: {
          'm-erika': { share: 50_000, pocket: 0 },
        },
      },
    ],
  ),

  lastMonth: makeReport(
    [
      {
        memberId: 'm-peti',
        memberName: 'Peti',
        shareByCurrency: [{ currency: 'HUF', amount: 200_000 }],
        pocketByCurrency: [{ currency: 'HUF', amount: 5_000 }],
      },
      {
        memberId: 'm-erika',
        memberName: 'Erika',
        shareByCurrency: [{ currency: 'HUF', amount: 80_000 }],
        pocketByCurrency: [{ currency: 'HUF', amount: 22_000 }],
      },
      {
        memberId: 'm-norbi',
        memberName: 'Norbi',
        shareByCurrency: [{ currency: 'HUF', amount: 50_000 }],
        pocketByCurrency: [],
      },
    ],
    6,
    [
      {
        period: '2026-10-05',
        byMember: {
          'm-peti': { share: 120_000, pocket: 0 },
          'm-norbi': { share: 50_000, pocket: 0 },
        },
      },
      {
        period: '2026-10-18',
        byMember: {
          'm-peti': { share: 80_000, pocket: 5_000 },
          'm-erika': { share: 80_000, pocket: 22_000 },
        },
      },
    ],
  ),

  thisYear: makeReport(
    [
      {
        memberId: 'm-peti',
        memberName: 'Peti',
        shareByCurrency: [
          { currency: 'HUF', amount: 450_000 },
          { currency: 'EUR', amount: 150 },
        ],
        pocketByCurrency: [{ currency: 'HUF', amount: 40_000 }],
      },
      {
        memberId: 'm-erika',
        memberName: 'Erika',
        shareByCurrency: [{ currency: 'HUF', amount: 320_000 }],
        pocketByCurrency: [{ currency: 'HUF', amount: 55_000 }],
      },
      {
        memberId: 'm-anna',
        memberName: 'Anna',
        shareByCurrency: [{ currency: 'HUF', amount: 180_000 }],
        pocketByCurrency: [{ currency: 'HUF', amount: 15_000 }],
      },
      {
        memberId: 'm-gabor',
        memberName: 'Gábor',
        shareByCurrency: [{ currency: 'EUR', amount: 100 }],
        pocketByCurrency: [{ currency: 'HUF', amount: 9_000 }],
      },
    ],
    22,
    [
      {
        period: '2026-01',
        byMember: {
          'm-peti': { share: 150_000, pocket: 10_000 },
          'm-erika': { share: 100_000, pocket: 20_000 },
          'm-anna': { share: 80_000, pocket: 0 },
        },
      },
      {
        period: '2026-03',
        byMember: {
          'm-peti': { share: 100_000, pocket: 15_000 },
          'm-gabor': { share: 0, pocket: 9_000 },
        },
      },
      {
        period: '2026-06',
        byMember: {
          'm-erika': { share: 120_000, pocket: 20_000 },
          'm-anna': { share: 100_000, pocket: 15_000 },
        },
      },
      {
        period: '2026-09',
        byMember: {
          'm-peti': { share: 200_000, pocket: 15_000 },
          'm-erika': { share: 100_000, pocket: 15_000 },
        },
      },
    ],
  ),

  /** Quiet week — empty state for the UI. */
  last7: null,
};

function filterHistory(
  history: MembershipHistoryPoint[],
  focus: LedgerFocus,
): MembershipHistoryPoint[] {
  if (focus === 'both') return history;

  return history
    .map((point) => {
      const byMember: MembershipHistoryPoint['byMember'] = {};
      for (const [memberId, amounts] of Object.entries(point.byMember)) {
        const next = {
          share: focus === 'share' ? amounts.share : 0,
          pocket: focus === 'pocket' ? amounts.pocket : 0,
        };
        if (next.share > 0 || next.pocket > 0) {
          byMember[memberId] = next;
        }
      }
      return { period: point.period, byMember };
    })
    .filter((point) => Object.keys(point.byMember).length > 0);
}

/** Apply ledger focus without mutating the stored mock. */
export function filterReportByFocus(
  report: MembershipShareReport,
  focus: LedgerFocus,
): MembershipShareReport {
  if (focus === 'both') {
    return {
      ...report,
      byMember: sortMembersByFocus(report.byMember, focus),
      history: report.history,
    };
  }

  const byMember = sortMembersByFocus(
    report.byMember.map((row) => ({
      ...row,
      shareByCurrency: focus === 'share' ? row.shareByCurrency : [],
      pocketByCurrency: focus === 'pocket' ? row.pocketByCurrency : [],
    })),
    focus,
  );

  return {
    kpis: {
      ...buildKpis(byMember, report.kpis.paymentCount),
      paymentCount: report.kpis.paymentCount,
    },
    byMember,
    historyCurrency: report.historyCurrency,
    history: filterHistory(report.history, focus),
  };
}

/** Synchronous mock lookup. `null` means empty for the preset. */
export function getMembershipShareReport(
  preset: DateRangePreset,
): MembershipShareReport | null {
  return REPORTS[preset];
}

const MOCK_DELAY_MS = 280;

/**
 * Async mock fetch. Rejects only when `forceError` is true (tests / debug).
 */
export function fetchMembershipShareReport(
  preset: DateRangePreset,
  options: { forceError?: boolean; delayMs?: number } = {},
): Promise<MembershipShareReport | null> {
  const delayMs = options.delayMs ?? MOCK_DELAY_MS;
  return new Promise((resolve, reject) => {
    globalThis.setTimeout(() => {
      if (options.forceError) {
        reject(new Error('membership-share mock failure'));
        return;
      }
      resolve(getMembershipShareReport(preset));
    }, delayMs);
  });
}
