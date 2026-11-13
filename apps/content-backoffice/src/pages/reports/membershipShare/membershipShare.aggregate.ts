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
import {
  KOR_CURRENCY_CODE,
  MEMBER_POCKET_ACCOUNT_CODE,
  MEMBER_SHARE_ACCOUNT_CODE,
  SHARE_CAPITAL_ACCOUNT_CODE,
  TREASURY_CLEARING_ACCOUNT_CODE,
} from './types';

export type MembershipShareTx = {
  date: string;
  amount: number;
  currencyCode: string;
  debitAccountId: string;
  creditAccountId: string;
  creditCode: string;
  debitCode: string;
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
 * Kincstári FX clearing in KOR on the share ledger (1900 ↔ 1101). Ignored so
 * Korona kiutalás does not cancel Tagi Lekötés Koronaként on 1101.
 */
export function isTreasuryKorMovement(tx: MembershipShareTx): boolean {
  if (tx.currencyCode !== KOR_CURRENCY_CODE) return false;
  const touchesTreasury =
    tx.creditCode === TREASURY_CLEARING_ACCOUNT_CODE ||
    tx.debitCode === TREASURY_CLEARING_ACCOUNT_CODE;
  if (!touchesTreasury) return false;
  return (
    tx.creditCode === MEMBER_SHARE_ACCOUNT_CODE ||
    tx.debitCode === MEMBER_SHARE_ACCOUNT_CODE
  );
}

function isMemberLedgerCode(code: string): boolean {
  return (
    code === MEMBER_SHARE_ACCOUNT_CODE || code === MEMBER_POCKET_ACCOUNT_CODE
  );
}

/**
 * External inflow into a member ledger (matches list drill-down: kifizető /
 * credit on 1101 or 1001). Pocket KOR (lekötés) is skipped — Homály has no
 * durable KOR on this report; only HUF credit-side zseb rows count.
 */
export function isMembershipSharePayment(
  tx: MembershipShareTx,
  memberAccountIds: ReadonlySet<string>,
): boolean {
  if (tx.amount === 0) return false;
  if (isTreasuryKorMovement(tx)) return false;
  if (
    memberAccountIds.has(tx.creditAccountId) &&
    memberAccountIds.has(tx.debitAccountId)
  ) {
    return false;
  }
  if (
    tx.creditCode === MEMBER_POCKET_ACCOUNT_CODE &&
    tx.currencyCode === KOR_CURRENCY_CODE
  ) {
    return false;
  }
  return (
    memberAccountIds.has(tx.creditAccountId) &&
    !memberAccountIds.has(tx.debitAccountId) &&
    isMemberLedgerCode(tx.creditCode) &&
    tx.debitCode !== SHARE_CAPITAL_ACCOUNT_CODE
  );
}

/**
 * Pocket debit legs that are not zseb-kivét on this report:
 * részjegytőke, Homály projekt-wash (5xxx), bank/kp (bányászás / félrekönyvelt
 * üzemanyag), terület-támogatás / stróman (4200, 1200), kincstár (1900).
 */
function isIgnoredPocketDeductionCredit(creditCode: string): boolean {
  if (
    creditCode === SHARE_CAPITAL_ACCOUNT_CODE ||
    creditCode === TREASURY_CLEARING_ACCOUNT_CODE ||
    creditCode === '1000' ||
    creditCode === '1100' ||
    creditCode === '1200' ||
    creditCode === '4200'
  ) {
    return true;
  }
  return /^5/.test(creditCode);
}

/**
 * External outflow: debit leaves 1101 (részjegy kivét), or debit leaves 1001
 * for a real zseb-kivét (e.g. 1001 ← 1720). Ignored pocket credits keep
 * Pál’s stróman / terület-támogatás / üzemanyag from flipping the orange bar.
 */
export function isMembershipShareDeduction(
  tx: MembershipShareTx,
  memberAccountIds: ReadonlySet<string>,
): boolean {
  if (tx.amount === 0) return false;
  if (isTreasuryKorMovement(tx)) return false;
  if (
    memberAccountIds.has(tx.creditAccountId) &&
    memberAccountIds.has(tx.debitAccountId)
  ) {
    return false;
  }
  if (
    !memberAccountIds.has(tx.debitAccountId) ||
    memberAccountIds.has(tx.creditAccountId)
  ) {
    return false;
  }
  if (tx.debitCode === MEMBER_SHARE_ACCOUNT_CODE) {
    return tx.creditCode !== SHARE_CAPITAL_ACCOUNT_CODE;
  }
  if (tx.debitCode === MEMBER_POCKET_ACCOUNT_CODE) {
    return !isIgnoredPocketDeductionCredit(tx.creditCode);
  }
  return false;
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

  const applyMemberAmount = (
    ref: MembershipShareMemberRef,
    ledger: 'share' | 'pocket',
    signedAmount: number,
    tx: MembershipShareTx,
    countPayment: boolean,
  ) => {
    if (countPayment) {
      if (ledger === 'share') sharePaymentCount += 1;
      else pocketPaymentCount += 1;
    }
    const acc = ensure(ref);
    const target =
      ledger === 'share' ? acc.shareByCurrency : acc.pocketByCurrency;
    target.set(
      tx.currencyCode,
      (target.get(tx.currencyCode) ?? 0) + signedAmount,
    );

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
    if (ledger === 'share') bucket.share += signedAmount;
    else bucket.pocket += signedAmount;
    currencyMap.set(tx.currencyCode, bucket);
  };

  for (const tx of txs) {
    if (isMembershipSharePayment(tx, memberAccountIds)) {
      // Credit on 1101 or 1001 (same as drill-down kifizető filter).
      const shareRef = byShareId.get(tx.creditAccountId);
      const pocketRef = byPocketId.get(tx.creditAccountId);
      const ref = shareRef ?? pocketRef;
      if (!ref) continue;
      const ledger: 'share' | 'pocket' = shareRef ? 'share' : 'pocket';
      applyMemberAmount(ref, ledger, tx.amount, tx, true);
      continue;
    }

    if (!isMembershipShareDeduction(tx, memberAccountIds)) continue;

    // Debit leaves 1101 or 1001.
    const shareRef = byShareId.get(tx.debitAccountId);
    const pocketRef = byPocketId.get(tx.debitAccountId);
    const ref = shareRef ?? pocketRef;
    if (!ref) continue;
    const ledger: 'share' | 'pocket' = shareRef ? 'share' : 'pocket';
    applyMemberAmount(ref, ledger, -tx.amount, tx, false);
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
