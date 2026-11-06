import { buildKpis, sortMembersByFocus } from './membershipShare.helpers';
import type {
  DateRangePreset,
  MembershipHistoryPoint,
  MembershipMemberRow,
  MembershipShareReport,
} from './types';

export {
  buildKpis,
  filterReportByFocus,
  historyAmountForFocus,
  memberFocusTotal,
  mergeCurrencyAmounts,
  sortMembersByFocus,
} from './membershipShare.helpers';

function members(rows: MembershipMemberRow[]): MembershipMemberRow[] {
  return sortMembersByFocus(rows, 'both');
}

function makeReport(
  rows: MembershipMemberRow[],
  sharePaymentCount: number,
  pocketPaymentCount: number,
  history: MembershipHistoryPoint[],
  historyCurrency = 'HUF',
): MembershipShareReport {
  const byMember = members(rows);
  return {
    kpis: buildKpis(byMember, sharePaymentCount, pocketPaymentCount, 'both'),
    byMember,
    historyCurrency,
    history,
  };
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
    28,
    19,
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
    5,
    4,
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
    4,
    2,
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
    14,
    8,
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

  last7: null,
};

/** Synchronous mock lookup. `null` means empty for the preset. */
export function getMembershipShareReport(
  preset: DateRangePreset,
): MembershipShareReport | null {
  return REPORTS[preset];
}

const MOCK_DELAY_MS = 280;

/** Async mock fetch for unit tests. */
export function fetchMembershipShareMock(
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
