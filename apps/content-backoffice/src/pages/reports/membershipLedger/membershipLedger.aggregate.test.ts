import { describe, expect, it } from 'vitest';

import type { MembershipShareTx } from '../membershipShare/membershipShare.aggregate';

import {
  aggregateMembershipLedgerReport,
  shouldIgnoreMembershipLedgerTx,
  type MembershipLedgerMembershipRef,
} from './membershipLedger.aggregate';

const peti: MembershipLedgerMembershipRef['members'][number] = {
  memberId: 'm-peti',
  memberName: 'Peti',
  shareAccountId: 'acc-peti-1101',
  pocketAccountId: 'acc-peti-1001',
};

const erika: MembershipLedgerMembershipRef['members'][number] = {
  memberId: 'm-erika',
  memberName: 'Erika',
  shareAccountId: 'acc-erika-1101',
  pocketAccountId: 'acc-erika-1001',
};

const groupA: MembershipLedgerMembershipRef = {
  membershipId: 'ms-a',
  membershipName: 'Alfa tagság',
  membershipTypeName: 'tag',
  members: [peti, erika],
};

const groupB: MembershipLedgerMembershipRef = {
  membershipId: 'ms-b',
  membershipName: 'Béta tagság',
  membershipTypeName: 'tag',
  members: [peti],
};

describe('shouldIgnoreMembershipLedgerTx', () => {
  it('ignores 1101↔3000', () => {
    expect(
      shouldIgnoreMembershipLedgerTx({
        date: '2026-11-01',
        amount: 50_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-peti-1101',
        creditAccountId: 'acc-3000',
        debitCode: '1101',
        creditCode: '3000',
      }),
    ).toBe(true);
  });

  it('ignores treasury KOR', () => {
    expect(
      shouldIgnoreMembershipLedgerTx({
        date: '2026-11-01',
        amount: 20_000,
        currencyCode: 'KOR',
        debitAccountId: 'acc-treasury',
        creditAccountId: 'acc-peti-1101',
        debitCode: '1100',
        creditCode: '1101',
      }),
    ).toBe(true);
  });
});

describe('aggregateMembershipLedgerReport', () => {
  it('computes payment, deduction and balance on 1101 and 1001', () => {
    const txs: MembershipShareTx[] = [
      {
        date: '2026-11-03',
        amount: 100_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-cash',
        creditAccountId: 'acc-peti-1101',
        creditCode: '1101',
        debitCode: '1000',
      },
      {
        date: '2026-11-04',
        amount: 30_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-peti-1101',
        creditAccountId: 'acc-cost',
        creditCode: '5510',
        debitCode: '1101',
      },
      {
        date: '2026-11-05',
        amount: 12_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-bank',
        creditAccountId: 'acc-peti-1001',
        creditCode: '1001',
        debitCode: '1100',
      },
      {
        date: '2026-11-06',
        amount: 2_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-peti-1001',
        creditAccountId: 'acc-loan',
        creditCode: '1720',
        debitCode: '1001',
      },
    ];

    const report = aggregateMembershipLedgerReport(txs, [groupA], 'HUF');
    expect(report).not.toBeNull();
    if (!report) return;

    const row = report.sections[0]?.members.find(
      (m) => m.memberId === 'm-peti',
    );
    expect(row).toMatchObject({
      sharePayment: 100_000,
      shareDeduction: 30_000,
      shareBalance: 70_000,
      pocketPayment: 12_000,
      pocketDeduction: 2_000,
      pocketBalance: 10_000,
    });
  });

  it('ignores 1001 debit to 5xx (homály / projekt wash)', () => {
    const txs: MembershipShareTx[] = [
      {
        date: '2026-11-06',
        amount: 2_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-peti-1001',
        creditAccountId: 'acc-cost',
        creditCode: '5510',
        debitCode: '1001',
      },
    ];

    const report = aggregateMembershipLedgerReport(txs, [groupA], 'HUF');
    const row = report?.sections[0]?.members.find(
      (m) => m.memberId === 'm-peti',
    );
    expect(row?.pocketDeduction).toBe(0);
  });

  it('ignores 1101↔1001 internal transfer', () => {
    const txs: MembershipShareTx[] = [
      {
        date: '2026-11-01',
        amount: 10_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-peti-1101',
        creditAccountId: 'acc-peti-1001',
        creditCode: '1001',
        debitCode: '1101',
      },
    ];

    const report = aggregateMembershipLedgerReport(txs, [groupA], 'HUF');
    expect(report).not.toBeNull();
    if (!report) return;
    const row = report.sections[0]?.members.find(
      (m) => m.memberId === 'm-peti',
    );
    expect(row).toMatchObject({
      sharePayment: 0,
      shareDeduction: 0,
      pocketPayment: 0,
      pocketDeduction: 0,
    });
  });

  it('repeats overlapping members per membership section', () => {
    const txs: MembershipShareTx[] = [
      {
        date: '2026-11-02',
        amount: 5_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-cash',
        creditAccountId: 'acc-peti-1101',
        creditCode: '1101',
        debitCode: '1000',
      },
    ];

    const report = aggregateMembershipLedgerReport(
      txs,
      [groupB, groupA],
      'HUF',
    );
    expect(report).not.toBeNull();
    if (!report) return;

    expect(report.sections.map((s) => s.membershipName)).toEqual([
      'Alfa tagság',
      'Béta tagság',
    ]);

    const inA = report.sections
      .find((s) => s.membershipId === 'ms-a')
      ?.members.find((m) => m.memberId === 'm-peti');
    const inB = report.sections
      .find((s) => s.membershipId === 'ms-b')
      ?.members.find((m) => m.memberId === 'm-peti');
    expect(inA?.sharePayment).toBe(5_000);
    expect(inB?.sharePayment).toBe(5_000);
  });

  it('does not count ignored 3000 leg as payment', () => {
    const txs: MembershipShareTx[] = [
      {
        date: '2026-11-01',
        amount: 40_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-peti-1101',
        creditAccountId: 'acc-3000',
        debitCode: '1101',
        creditCode: '3000',
      },
      {
        date: '2026-11-01',
        amount: 15_000,
        currencyCode: 'HUF',
        debitAccountId: 'acc-cash',
        creditAccountId: 'acc-peti-1101',
        creditCode: '1101',
        debitCode: '1000',
      },
    ];

    const report = aggregateMembershipLedgerReport(txs, [groupA], 'HUF');
    const row = report?.sections[0]?.members.find(
      (m) => m.memberId === 'm-peti',
    );
    expect(row?.sharePayment).toBe(15_000);
    expect(row?.shareDeduction).toBe(0);
  });
});
