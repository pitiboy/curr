import { periodKeyForPreset } from './dateRange';
import {
  buildKpis,
  pickHistoryCurrency,
  sortMembersByFocus,
} from './membershipShare.helpers';
import type {
  CurrencyAmount,
  DateRangePreset,
  MembershipHistoryPoint,
  MembershipMemberRow,
  MembershipShareReport,
} from './types';
import { MEMBER_POCKET_ACCOUNT_CODE, MEMBER_SHARE_ACCOUNT_CODE } from './types';

export type MembershipShareTx = {
  date: string;
  amount: number;
  currencyCode: string;
  debitAccountId: string;
  creditAccountId: string;
  creditCode: string;
};

export type MembershipShareMemberRef = {
  memberId: string;
  memberName: string;
  /** 1101 tagi számla documentId. */
  shareAccountId: string | null;
  /** 1001 saját / zseb documentId. */
  pocketAccountId: string | null;
};

type MemberAcc = {
  memberId: string;
  memberName: string;
  shareAccountId: string | null;
  pocketAccountId: string | null;
  shareByCurrency: Map<string, number>;
  pocketByCurrency: Map<string, number>;
};

function normalizeDate(raw: string): string {
  return raw.slice(0, 10);
}

function currencyMapToList(map: Map<string, number>): CurrencyAmount[] {
  return [...map.entries()]
    .filter(([, amount]) => amount !== 0)
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * External inflow into a member ledger: credit lands on 1101/1001, debit does
 * not (excludes 1101↔1001 internal transfers).
 */
export function isMembershipSharePayment(
  tx: MembershipShareTx,
  memberAccountIds: ReadonlySet<string>,
): boolean {
  if (tx.amount === 0) return false;
  if (!memberAccountIds.has(tx.creditAccountId)) return false;
  if (memberAccountIds.has(tx.debitAccountId)) return false;
  return (
    tx.creditCode === MEMBER_SHARE_ACCOUNT_CODE ||
    tx.creditCode === MEMBER_POCKET_ACCOUNT_CODE
  );
}

/**
 * Aggregate published member-ledger inflows into the report shape.
 * Returns null when nothing matched in range.
 */
export function aggregateMembershipShareReport(
  txs: readonly MembershipShareTx[],
  members: readonly MembershipShareMemberRef[],
  preset: DateRangePreset,
): MembershipShareReport | null {
  const byShareId = new Map<string, MembershipShareMemberRef>();
  const byPocketId = new Map<string, MembershipShareMemberRef>();
  const memberAccountIds = new Set<string>();

  for (const member of members) {
    if (member.shareAccountId) {
      memberAccountIds.add(member.shareAccountId);
      byShareId.set(member.shareAccountId, member);
    }
    if (member.pocketAccountId) {
      memberAccountIds.add(member.pocketAccountId);
      byPocketId.set(member.pocketAccountId, member);
    }
  }

  const accByMember = new Map<string, MemberAcc>();
  const ensure = (ref: MembershipShareMemberRef): MemberAcc => {
    let row = accByMember.get(ref.memberId);
    if (!row) {
      row = {
        memberId: ref.memberId,
        memberName: ref.memberName,
        shareAccountId: ref.shareAccountId,
        pocketAccountId: ref.pocketAccountId,
        shareByCurrency: new Map(),
        pocketByCurrency: new Map(),
      };
      accByMember.set(ref.memberId, row);
    }
    return row;
  };

  /** period → memberId → { share, pocket } in raw currencies (all FX kept). */
  const historyRaw = new Map<
    string,
    Map<string, Map<string, { share: number; pocket: number }>>
  >();
  let sharePaymentCount = 0;
  let pocketPaymentCount = 0;

  for (const tx of txs) {
    if (!isMembershipSharePayment(tx, memberAccountIds)) continue;

    const shareRef = byShareId.get(tx.creditAccountId);
    const pocketRef = byPocketId.get(tx.creditAccountId);
    const ref = shareRef ?? pocketRef;
    if (!ref) continue;

    const ledger: 'share' | 'pocket' = shareRef ? 'share' : 'pocket';
    if (ledger === 'share') sharePaymentCount += 1;
    else pocketPaymentCount += 1;
    const acc = ensure(ref);
    const target =
      ledger === 'share' ? acc.shareByCurrency : acc.pocketByCurrency;
    target.set(tx.currencyCode, (target.get(tx.currencyCode) ?? 0) + tx.amount);

    const period = periodKeyForPreset(normalizeDate(tx.date), preset);
    let periodMap = historyRaw.get(period);
    if (!periodMap) {
      periodMap = new Map();
      historyRaw.set(period, periodMap);
    }
    let currencyMap = periodMap.get(ref.memberId);
    if (!currencyMap) {
      currencyMap = new Map();
      periodMap.set(ref.memberId, currencyMap);
    }
    const bucket = currencyMap.get(tx.currencyCode) ?? {
      share: 0,
      pocket: 0,
    };
    if (ledger === 'share') bucket.share += tx.amount;
    else bucket.pocket += tx.amount;
    currencyMap.set(tx.currencyCode, bucket);
  }

  if (accByMember.size === 0) {
    return null;
  }

  const byMember: MembershipMemberRow[] = sortMembersByFocus(
    [...accByMember.values()].map((row) => ({
      memberId: row.memberId,
      memberName: row.memberName,
      shareAccountId: row.shareAccountId,
      pocketAccountId: row.pocketAccountId,
      shareByCurrency: currencyMapToList(row.shareByCurrency),
      pocketByCurrency: currencyMapToList(row.pocketByCurrency),
    })),
    'both',
  );

  const historyCurrency = pickHistoryCurrency(byMember);
  const history: MembershipHistoryPoint[] = [...historyRaw.keys()]
    .sort()
    .map((period) => {
      const byMemberPeriod: MembershipHistoryPoint['byMember'] = {};
      for (const [memberId, currencyMap] of historyRaw.get(period) ?? []) {
        const amounts = currencyMap.get(historyCurrency);
        if (!amounts) continue;
        if (amounts.share === 0 && amounts.pocket === 0) continue;
        byMemberPeriod[memberId] = {
          share: amounts.share,
          pocket: amounts.pocket,
        };
      }
      return { period, byMember: byMemberPeriod };
    })
    .filter((point) => Object.keys(point.byMember).length > 0);

  return {
    kpis: buildKpis(byMember, sharePaymentCount, pocketPaymentCount, 'both'),
    byMember,
    historyCurrency,
    history,
  };
}

/** Exposed for tests that assert KPI identities without re-deriving. */
export function memberCurrencyTotalsMatchHistory(
  report: MembershipShareReport,
): boolean {
  const share = new Map<string, number>();
  const pocket = new Map<string, number>();
  for (const point of report.history) {
    for (const [memberId, amounts] of Object.entries(point.byMember)) {
      share.set(memberId, (share.get(memberId) ?? 0) + amounts.share);
      pocket.set(memberId, (pocket.get(memberId) ?? 0) + amounts.pocket);
    }
  }
  for (const row of report.byMember) {
    const expectedShare =
      row.shareByCurrency.find((c) => c.currency === report.historyCurrency)
        ?.amount ?? 0;
    const expectedPocket =
      row.pocketByCurrency.find((c) => c.currency === report.historyCurrency)
        ?.amount ?? 0;
    if ((share.get(row.memberId) ?? 0) !== expectedShare) return false;
    if ((pocket.get(row.memberId) ?? 0) !== expectedPocket) return false;
  }
  return true;
}
