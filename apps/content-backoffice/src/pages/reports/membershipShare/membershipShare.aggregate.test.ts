import { describe, expect, it } from 'vitest';

import {
  aggregateMembershipShareReport,
  isMembershipShareDeduction,
  isMembershipSharePayment,
  isTreasuryKorMovement,
  memberCurrencyTotalsMatchHistory,
  type MembershipShareMemberRef,
  type MembershipShareTx,
} from './membershipShare.aggregate';

const members: MembershipShareMemberRef[] = [
  {
    memberId: 'm-peti',
    memberName: 'Peti',
    shareAccountId: 'acc-peti-1101',
    pocketAccountId: 'acc-peti-1001',
  },
  {
    memberId: 'm-erika',
    memberName: 'Erika',
    shareAccountId: 'acc-erika-1101',
    pocketAccountId: 'acc-erika-1001',
  },
];

const memberIds = new Set([
  'acc-peti-1101',
  'acc-peti-1001',
  'acc-erika-1101',
  'acc-erika-1001',
]);

describe('isMembershipSharePayment', () => {
  it('accepts external credit into 1101', () => {
    expect(
      isMembershipSharePayment(
        {
          date: '2026-11-01',
          amount: 100_000,
          currencyCode: 'HUF',
          debitAccountId: 'acc-cash',
          creditAccountId: 'acc-peti-1101',
          creditCode: '1101',
          debitCode: '1000',
        },
        memberIds,
      ),
    ).toBe(true);
  });

  it('rejects 1101→1001 internal transfer', () => {
    expect(
      isMembershipSharePayment(
        {
          date: '2026-11-01',
          amount: 10_000,
          currencyCode: 'HUF',
          debitAccountId: 'acc-peti-1101',
          creditAccountId: 'acc-peti-1001',
          creditCode: '1001',
          debitCode: '1101',
        },
        memberIds,
      ),
    ).toBe(false);
  });

  it('rejects részjegytőke törlés (3000 debit / 1101 credit)', () => {
    expect(
      isMembershipSharePayment(
        {
          date: '2025-12-18',
          amount: 5_000_000,
          currencyCode: 'HUF',
          debitAccountId: 'acc-capital-3000',
          creditAccountId: 'acc-peti-1101',
          creditCode: '1101',
          debitCode: '3000',
        },
        memberIds,
      ),
    ).toBe(false);
  });
});

describe('isMembershipShareDeduction', () => {
  it('accepts external debit from 1001 (Homály kiadás)', () => {
    expect(
      isMembershipShareDeduction(
        {
          date: '2026-11-01',
          amount: 12_000,
          currencyCode: 'HUF',
          debitAccountId: 'acc-peti-1001',
          creditAccountId: 'acc-cost',
          creditCode: '5510',
          debitCode: '1001',
        },
        memberIds,
      ),
    ).toBe(true);
  });

  it('rejects 1001→1101 internal transfer', () => {
    expect(
      isMembershipShareDeduction(
        {
          date: '2026-11-01',
          amount: 10_000,
          currencyCode: 'HUF',
          debitAccountId: 'acc-peti-1101',
          creditAccountId: 'acc-peti-1001',
          creditCode: '1001',
          debitCode: '1101',
        },
        memberIds,
      ),
    ).toBe(false);
  });

  it('rejects részjegytőke előírás (1101 debit / 3000 credit)', () => {
    expect(
      isMembershipShareDeduction(
        {
          date: '2025-02-21',
          amount: 11_500_000,
          currencyCode: 'HUF',
          debitAccountId: 'acc-peti-1101',
          creditAccountId: 'acc-capital-3000',
          creditCode: '3000',
          debitCode: '1101',
        },
        memberIds,
      ),
    ).toBe(false);
  });

  it('rejects kincstári KOR kiutalás (1101 debit / 1900 credit)', () => {
    const tx: MembershipShareTx = {
      date: '2025-02-21',
      amount: 19_166.67,
      currencyCode: 'KOR',
      debitAccountId: 'acc-peti-1101',
      creditAccountId: 'acc-treasury-1900',
      creditCode: '1900',
      debitCode: '1101',
    };
    expect(isTreasuryKorMovement(tx)).toBe(true);
    expect(isMembershipShareDeduction(tx, memberIds)).toBe(false);
  });
});

describe('isTreasuryKorMovement', () => {
  it('is true only for KOR legs touching 1900', () => {
    expect(
      isTreasuryKorMovement({
        date: '2025-02-21',
        amount: 1,
        currencyCode: 'KOR',
        debitAccountId: 'acc-a',
        creditAccountId: 'acc-b',
        creditCode: '1900',
        debitCode: '1101',
      }),
    ).toBe(true);
    expect(
      isTreasuryKorMovement({
        date: '2025-02-21',
        amount: 1,
        currencyCode: 'HUF',
        debitAccountId: 'acc-a',
        creditAccountId: 'acc-b',
        creditCode: '1900',
        debitCode: '1520',
      }),
    ).toBe(false);
    expect(
      isTreasuryKorMovement({
        date: '2025-02-21',
        amount: 1,
        currencyCode: 'KOR',
        debitAccountId: 'acc-land',
        creditAccountId: 'acc-peti-1101',
        creditCode: '1101',
        debitCode: '1510',
      }),
    ).toBe(false);
  });
});

describe('aggregateMembershipShareReport', () => {
  it('aggregates share and pocket by currency and history', () => {
    const txs: MembershipShareTx[] = [
      {
        date: '2026-11-03',
        amount: 150_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-cash',
        creditAccountId: 'acc-peti-1101',
        creditCode: '1101',
        debitCode: '1000',
      },
      {
        date: '2026-11-10',
        amount: 12_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-cash',
        creditAccountId: 'acc-peti-1001',
        creditCode: '1001',
        debitCode: '1000',
      },
      {
        date: '2026-11-10',
        amount: 100_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-bank',
        creditAccountId: 'acc-erika-1101',
        creditCode: '1101',
        debitCode: '1100',
      },
      {
        date: '2026-11-10',
        amount: 5_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-peti-1101',
        creditAccountId: 'acc-peti-1001',
        creditCode: '1001',
        debitCode: '1101',
      },
    ];

    const report = aggregateMembershipShareReport(txs, members, 'thisMonth');
    expect(report).not.toBeNull();
    if (!report) return;

    expect(report.kpis.sharePaymentCount).toBe(2);
    expect(report.kpis.pocketPaymentCount).toBe(1);
    expect(report.kpis.paymentCount).toBe(3);
    expect(report.kpis.memberCount).toBe(2);
    expect(report.historyCurrency).toBe('HUF');
    expect(report.byMember[0]?.memberName).toBe('Peti');
    expect(report.byMember[0]?.shareByCurrency).toEqual([
      { currency: 'HUF', amount: 150_000 },
    ]);
    expect(report.byMember[0]?.pocketByCurrency).toEqual([
      { currency: 'HUF', amount: 12_000 },
    ]);
    expect(memberCurrencyTotalsMatchHistory(report)).toBe(true);
    expect(report.history.map((p) => p.period)).toEqual([
      '2026-11-03',
      '2026-11-10',
    ]);
  });

  it('returns null when no external payments', () => {
    expect(
      aggregateMembershipShareReport(
        [
          {
            date: '2026-11-01',
            amount: 1,
            currencyCode: 'HUF',
            debitAccountId: 'acc-peti-1101',
            creditAccountId: 'acc-peti-1001',
            creditCode: '1001',
            debitCode: '1101',
          },
        ],
        members,
        'thisMonth',
      ),
    ).toBeNull();
  });

  it('counts 1101 and 1001 credits separately', () => {
    const txs: MembershipShareTx[] = [
      {
        date: '2026-11-05',
        amount: 100_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-cash',
        creditAccountId: 'acc-erika-1101',
        creditCode: '1101',
        debitCode: '1000',
      },
      {
        date: '2026-11-06',
        amount: 5_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-bank',
        creditAccountId: 'acc-erika-1001',
        creditCode: '1001',
        debitCode: '1100',
      },
    ];
    const report = aggregateMembershipShareReport(txs, members, 'thisMonth');
    expect(report).not.toBeNull();
    if (!report) return;
    expect(report.kpis.sharePaymentCount).toBe(1);
    expect(report.kpis.pocketPaymentCount).toBe(1);
    expect(report.kpis.paymentCount).toBe(2);
  });

  it('keeps members with negative net (non-treasury KOR outflow)', () => {
    const txs: MembershipShareTx[] = [
      {
        date: '2026-11-05',
        amount: 100_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-bank',
        creditAccountId: 'acc-erika-1101',
        creditCode: '1101',
        debitCode: '1100',
      },
      {
        date: '2026-11-05',
        amount: 500_000,
        currencyCode: 'KOR',
        debitAccountId: 'acc-erika-1101',
        creditAccountId: 'acc-cost',
        creditCode: '5510',
        debitCode: '1101',
      },
    ];
    const report = aggregateMembershipShareReport(txs, members, 'thisMonth');
    expect(report).not.toBeNull();
    if (!report) return;
    expect(report.kpis.memberCount).toBe(1);
    expect(report.byMember).toHaveLength(1);
    expect(report.byMember[0]?.memberName).toBe('Erika');
    expect(report.byMember[0]?.shareByCurrency).toEqual([
      { currency: 'HUF', amount: 100_000 },
      { currency: 'KOR', amount: -500_000 },
    ]);
  });

  it('does not drop a member when HUF and KOR nets cancel if summed across FX', () => {
    const txs: MembershipShareTx[] = [
      {
        date: '2026-11-05',
        amount: 500_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-bank',
        creditAccountId: 'acc-erika-1101',
        creditCode: '1101',
        debitCode: '1100',
      },
      {
        date: '2026-11-05',
        amount: 500_000,
        currencyCode: 'KOR',
        debitAccountId: 'acc-erika-1101',
        creditAccountId: 'acc-cost',
        creditCode: '5510',
        debitCode: '1101',
      },
    ];
    const report = aggregateMembershipShareReport(txs, members, 'thisMonth');
    expect(report).not.toBeNull();
    if (!report) return;
    expect(report.kpis.memberCount).toBe(1);
    expect(report.byMember[0]?.memberName).toBe('Erika');
    expect(report.byMember[0]?.shareByCurrency).toEqual([
      { currency: 'HUF', amount: 500_000 },
      { currency: 'KOR', amount: -500_000 },
    ]);
  });

  it('keeps Tagi Lekötés KOR when kincstári kiutalás is ignored', () => {
    const txs: MembershipShareTx[] = [
      {
        date: '2025-02-21',
        amount: 19_166.67,
        currencyCode: 'KOR',
        debitAccountId: 'acc-erika-1101',
        creditAccountId: 'acc-treasury-1900',
        creditCode: '1900',
        debitCode: '1101',
      },
      {
        date: '2025-02-21',
        amount: 19_166.67,
        currencyCode: 'KOR',
        debitAccountId: 'acc-land',
        creditAccountId: 'acc-erika-1101',
        creditCode: '1101',
        debitCode: '1510',
      },
    ];
    const report = aggregateMembershipShareReport(txs, members, 'all');
    expect(report).not.toBeNull();
    if (!report) return;
    expect(report.kpis.sharePaymentCount).toBe(1);
    expect(report.byMember[0]?.memberName).toBe('Erika');
    expect(report.byMember[0]?.shareByCurrency).toEqual([
      { currency: 'KOR', amount: 19_166.67 },
    ]);
  });

  it('nets ügylet pocket inflow and cost (tagi befizetés ingatlanra)', () => {
    const member: MembershipShareMemberRef[] = [
      {
        memberId: 'm-erika',
        memberName: 'Erika',
        shareAccountId: 'acc-erika-1101',
        pocketAccountId: 'acc-erika-1001',
      },
    ];
    const txs: MembershipShareTx[] = [
      {
        date: '2026-11-05',
        amount: 2_000_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-bank',
        creditAccountId: 'acc-erika-1101',
        creditCode: '1101',
        debitCode: '1100',
      },
      {
        date: '2026-11-05',
        amount: 2_000_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-erika-1001',
        creditAccountId: 'acc-bank',
        creditCode: '1100',
        debitCode: '1001',
      },
      {
        date: '2026-11-05',
        amount: 2_000_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-land',
        creditAccountId: 'acc-erika-1001',
        creditCode: '1001',
        debitCode: '1520',
      },
    ];

    const report = aggregateMembershipShareReport(txs, member, 'thisMonth');
    expect(report).not.toBeNull();
    if (!report) return;

    expect(report.kpis.sharePaymentCount).toBe(1);
    expect(report.kpis.pocketPaymentCount).toBe(1);
    expect(report.byMember[0]?.shareByCurrency).toEqual([
      { currency: 'HUF', amount: 2_000_000 },
    ]);
    expect(report.byMember[0]?.pocketByCurrency).toEqual([]);
    expect(memberCurrencyTotalsMatchHistory(report)).toBe(true);
  });

  it('keeps HUF befizetés when ügylet books részjegytőke előírás + bejövő utalás', () => {
    const member: MembershipShareMemberRef[] = [
      {
        memberId: 'm-dani',
        memberName: 'Dani',
        shareAccountId: 'acc-dani-1101',
        pocketAccountId: 'acc-dani-1001',
      },
    ];
    const txs: MembershipShareTx[] = [
      {
        date: '2025-02-21',
        amount: 11_500_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-dani-1101',
        creditAccountId: 'acc-capital-3000',
        creditCode: '3000',
        debitCode: '1101',
      },
      {
        date: '2025-02-21',
        amount: 11_500_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-bank',
        creditAccountId: 'acc-dani-1101',
        creditCode: '1101',
        debitCode: '1100',
      },
      {
        date: '2025-02-21',
        amount: 19_166.67,
        currencyCode: 'KOR',
        debitAccountId: 'acc-dani-1101',
        creditAccountId: 'acc-treasury-1900',
        creditCode: '1900',
        debitCode: '1101',
      },
      {
        date: '2025-02-21',
        amount: 19_166.67,
        currencyCode: 'KOR',
        debitAccountId: 'acc-land',
        creditAccountId: 'acc-dani-1101',
        creditCode: '1101',
        debitCode: '1510',
      },
    ];

    const report = aggregateMembershipShareReport(txs, member, 'all');
    expect(report).not.toBeNull();
    if (!report) return;

    expect(report.kpis.sharePaymentCount).toBe(2);
    expect(report.byMember[0]?.memberName).toBe('Dani');
    expect(report.byMember[0]?.shareByCurrency).toEqual([
      { currency: 'HUF', amount: 11_500_000 },
      { currency: 'KOR', amount: 19_166.67 },
    ]);
    expect(memberCurrencyTotalsMatchHistory(report)).toBe(true);
  });

  it('deducts szabad kölcsön when ügylet books részjegytőke törlés + kimenő utalás', () => {
    const member: MembershipShareMemberRef[] = [
      {
        memberId: 'm-erika',
        memberName: 'Erika',
        shareAccountId: 'acc-erika-1101',
        pocketAccountId: 'acc-erika-1001',
      },
    ];
    const txs: MembershipShareTx[] = [
      {
        date: '2025-01-10',
        amount: 13_202_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-bank',
        creditAccountId: 'acc-erika-1101',
        creditCode: '1101',
        debitCode: '1100',
      },
      {
        date: '2025-12-18',
        amount: 5_000_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-capital-3000',
        creditAccountId: 'acc-erika-1101',
        creditCode: '1101',
        debitCode: '3000',
      },
      {
        date: '2025-12-18',
        amount: 5_000_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-erika-1101',
        creditAccountId: 'acc-bank',
        creditCode: '1100',
        debitCode: '1101',
      },
    ];

    const report = aggregateMembershipShareReport(txs, member, 'all');
    expect(report).not.toBeNull();
    if (!report) return;

    expect(report.kpis.sharePaymentCount).toBe(1);
    expect(report.byMember[0]?.memberName).toBe('Erika');
    expect(report.byMember[0]?.shareByCurrency).toEqual([
      { currency: 'HUF', amount: 8_202_000 },
    ]);
    expect(memberCurrencyTotalsMatchHistory(report)).toBe(true);
  });
});
