import {
  isMembershipShareDeduction,
  isMembershipSharePayment,
  type MembershipShareTx,
} from '../membershipShare/membershipShare.aggregate';
import type {
  MembershipLedgerMemberRow,
  MembershipLedgerReport,
  MembershipLedgerSection,
} from './types';
import {
  MEMBERSHIP_LEDGER_EQUITY_ACCOUNT_CODE as EQUITY_CODE,
  MEMBERSHIP_LEDGER_TREASURY_ACCOUNT_CODE as TREASURY_CODE,
} from './types';

export type MembershipLedgerMemberRef = {
  memberId: string;
  memberName: string;
  shareAccountId: string | null;
  pocketAccountId: string | null;
};

export type MembershipLedgerMembershipRef = {
  membershipId: string;
  membershipName: string;
  membershipTypeName: string | null;
  members: readonly MembershipLedgerMemberRef[];
};

type MemberLedgerAcc = {
  sharePayment: number;
  shareDeduction: number;
  pocketPayment: number;
  pocketDeduction: number;
};

function emptyLedger(): MemberLedgerAcc {
  return {
    sharePayment: 0,
    shareDeduction: 0,
    pocketPayment: 0,
    pocketDeduction: 0,
  };
}

function toRow(
  ref: MembershipLedgerMemberRef,
  acc: MemberLedgerAcc,
): MembershipLedgerMemberRow {
  return {
    memberId: ref.memberId,
    memberName: ref.memberName,
    sharePayment: acc.sharePayment,
    shareDeduction: acc.shareDeduction,
    shareBalance: acc.sharePayment - acc.shareDeduction,
    pocketPayment: acc.pocketPayment,
    pocketDeduction: acc.pocketDeduction,
    pocketBalance: acc.pocketPayment - acc.pocketDeduction,
  };
}

/** 1101↔3000 részjegytőke átvezetés és kincstár-KOR tételek kimaradnak. */
export function shouldIgnoreMembershipLedgerTx(tx: MembershipShareTx): boolean {
  if (tx.debitCode === EQUITY_CODE || tx.creditCode === EQUITY_CODE) {
    return true;
  }
  if (
    tx.currencyCode === 'KOR' &&
    (tx.debitCode === TREASURY_CODE || tx.creditCode === TREASURY_CODE)
  ) {
    return true;
  }
  return false;
}

function memberIdsForMemberships(
  memberships: readonly MembershipLedgerMembershipRef[],
): Set<string> {
  const ids = new Set<string>();
  for (const membership of memberships) {
    for (const member of membership.members) {
      if (member.shareAccountId) ids.add(member.shareAccountId);
      if (member.pocketAccountId) ids.add(member.pocketAccountId);
    }
  }
  return ids;
}

function resolveMemberFromTx(
  tx: MembershipShareTx,
  byShareId: Map<string, MembershipLedgerMemberRef>,
  byPocketId: Map<string, MembershipLedgerMemberRef>,
  kind: 'payment' | 'deduction',
): { ref: MembershipLedgerMemberRef; ledger: 'share' | 'pocket' } | null {
  if (kind === 'payment') {
    const shareRef = byShareId.get(tx.creditAccountId);
    const pocketRef = byPocketId.get(tx.creditAccountId);
    const ref = shareRef ?? pocketRef;
    if (!ref) return null;
    return { ref, ledger: shareRef ? 'share' : 'pocket' };
  }
  const shareRef = byShareId.get(tx.debitAccountId);
  const pocketRef = byPocketId.get(tx.debitAccountId);
  const ref = shareRef ?? pocketRef;
  if (!ref) return null;
  return { ref, ledger: shareRef ? 'share' : 'pocket' };
}

/**
 * Aggregate befizetés / befektetés / egyenleg tagonként, tagságonként.
 * `currency` selects one FX; amounts are never mixed across currencies.
 */
export function aggregateMembershipLedgerReport(
  txs: readonly MembershipShareTx[],
  memberships: readonly MembershipLedgerMembershipRef[],
  currency: string,
): MembershipLedgerReport | null {
  const memberAccountIds = memberIdsForMemberships(memberships);

  const byShareId = new Map<string, MembershipLedgerMemberRef>();
  const byPocketId = new Map<string, MembershipLedgerMemberRef>();
  const membershipIdsByMemberId = new Map<string, Set<string>>();

  for (const membership of memberships) {
    for (const member of membership.members) {
      if (member.shareAccountId) {
        byShareId.set(member.shareAccountId, member);
      }
      if (member.pocketAccountId) {
        byPocketId.set(member.pocketAccountId, member);
      }
      let set = membershipIdsByMemberId.get(member.memberId);
      if (!set) {
        set = new Set();
        membershipIdsByMemberId.set(member.memberId, set);
      }
      set.add(membership.membershipId);
    }
  }

  const currencies = new Set<string>();
  const amountsByMembershipMember = new Map<string, MemberLedgerAcc>();

  const cellKey = (membershipId: string, memberId: string) =>
    `${membershipId}:${memberId}`;

  const ensure = (membershipId: string, memberId: string): MemberLedgerAcc => {
    const key = cellKey(membershipId, memberId);
    let acc = amountsByMembershipMember.get(key);
    if (!acc) {
      acc = emptyLedger();
      amountsByMembershipMember.set(key, acc);
    }
    return acc;
  };

  for (const tx of txs) {
    if (tx.currencyCode !== currency) continue;
    currencies.add(tx.currencyCode);
    if (shouldIgnoreMembershipLedgerTx(tx)) continue;

    if (isMembershipSharePayment(tx, memberAccountIds)) {
      const resolved = resolveMemberFromTx(
        tx,
        byShareId,
        byPocketId,
        'payment',
      );
      if (!resolved) continue;
      const membershipIds = membershipIdsByMemberId.get(resolved.ref.memberId);
      if (!membershipIds) continue;
      for (const membershipId of membershipIds) {
        const acc = ensure(membershipId, resolved.ref.memberId);
        if (resolved.ledger === 'share') acc.sharePayment += tx.amount;
        else acc.pocketPayment += tx.amount;
      }
      continue;
    }

    if (!isMembershipShareDeduction(tx, memberAccountIds)) continue;

    const resolved = resolveMemberFromTx(
      tx,
      byShareId,
      byPocketId,
      'deduction',
    );
    if (!resolved) continue;
    const membershipIds = membershipIdsByMemberId.get(resolved.ref.memberId);
    if (!membershipIds) continue;
    for (const membershipId of membershipIds) {
      const acc = ensure(membershipId, resolved.ref.memberId);
      if (resolved.ledger === 'share') acc.shareDeduction += tx.amount;
      else acc.pocketDeduction += tx.amount;
    }
  }

  for (const tx of txs) {
    currencies.add(tx.currencyCode);
  }

  const sortedCurrencyList = [...currencies].sort();
  const defaultCurrency = sortedCurrencyList.includes('HUF')
    ? 'HUF'
    : (sortedCurrencyList[0] ?? currency);

  const sections: MembershipLedgerSection[] = [];

  for (const membership of [...memberships].sort((a, b) =>
    a.membershipName.localeCompare(b.membershipName, 'hu'),
  )) {
    if (membership.members.length === 0) continue;

    const members = [...membership.members]
      .sort((a, b) => a.memberName.localeCompare(b.memberName, 'hu'))
      .map((ref) => {
        const acc =
          amountsByMembershipMember.get(
            cellKey(membership.membershipId, ref.memberId),
          ) ?? emptyLedger();
        return toRow(ref, acc);
      });

    sections.push({
      membershipId: membership.membershipId,
      membershipName: membership.membershipName,
      membershipTypeName: membership.membershipTypeName,
      members,
    });
  }

  if (sections.length === 0) {
    return null;
  }

  return {
    currencies: sortedCurrencyList,
    defaultCurrency,
    sections,
  };
}

/** @internal type re-export for tests */
export type { MembershipShareTx };
