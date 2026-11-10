import { describe, expect, it } from 'vitest';

import {
  aggregateMembershipShareReport,
  isMembershipShareDeduction,
  isMembershipSharePayment,
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
});
