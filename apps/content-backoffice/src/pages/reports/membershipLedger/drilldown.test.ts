import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONVERTED_FILTER,
  MEMBER_LEDGER_ACCOUNT_IN_FILTER_KEY,
  MEMBERSHIP_LEDGER_MODE_FILTER_KEY,
  MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY,
} from '../../../data/transactionList';
import { filterFromListSearch } from '../../../data/transactionListLocation';

import {
  drilldownForMemberCell,
  drilldownForMemberRow,
  MEMBERSHIP_LEDGER_DRILLDOWN_CONVERTED_FILTER,
} from './drilldown';

describe('MEMBERSHIP_LEDGER_DRILLDOWN_CONVERTED_FILTER', () => {
  it('matches none + expanded', () => {
    expect(MEMBERSHIP_LEDGER_DRILLDOWN_CONVERTED_FILTER).toEqual([
      ...DEFAULT_CONVERTED_FILTER,
    ]);
  });
});

describe('membershipLedger drilldown', () => {
  const context = {
    range: 'all' as const,
    bounds: { from: null, to: '2026-11-13' },
    transactionStatus: 'preview' as const,
    currencyCode: 'HUF',
  };

  const member = {
    memberId: 'm-1',
    memberName: 'Teszt',
    shareAccountId: 'acc-1101',
    pocketAccountId: 'acc-1001',
    sharePayment: 1,
    shareDeduction: 0,
    shareBalance: 1,
    pocketPayment: 0,
    pocketDeduction: 2,
    pocketBalance: -2,
  };

  it('maps payment cell to credit + external filter', () => {
    const link = drilldownForMemberCell(context, member, 'share', 'payment');
    const filter = filterFromListSearch(link.search);
    expect(filter).toMatchObject({
      converted_to_workflow: [...MEMBERSHIP_LEDGER_DRILLDOWN_CONVERTED_FILTER],
      currency_type: 'HUF',
      credit_account: 'acc-1101',
      status: 'published',
      [MEMBERSHIP_LEDGER_MODE_FILTER_KEY]: 'payment',
      [MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY]: true,
    });
    expect(filter.date_lte).toBe('2026-11-13');
    expect(filter.date_gte).toBeUndefined();
  });

  it('maps deduction cell to debit + mode', () => {
    const link = drilldownForMemberCell(context, member, 'pocket', 'deduction');
    const filter = filterFromListSearch(link.search);
    expect(filter).toMatchObject({
      debit_account: 'acc-1001',
      [MEMBERSHIP_LEDGER_MODE_FILTER_KEY]: 'deduction',
      currency_type: 'HUF',
    });
    expect(filter[MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY]).toBeUndefined();
  });

  it('maps balance cell to member_ledger_account_in', () => {
    const link = drilldownForMemberCell(context, member, 'share', 'balance');
    const filter = filterFromListSearch(link.search);
    expect(filter[MEMBER_LEDGER_ACCOUNT_IN_FILTER_KEY]).toEqual(['acc-1101']);
    expect(filter[MEMBERSHIP_LEDGER_MODE_FILTER_KEY]).toBe('balance');
  });

  it('maps member row to both account ids', () => {
    const link = drilldownForMemberRow(context, member);
    const filter = filterFromListSearch(link.search);
    expect(filter[MEMBER_LEDGER_ACCOUNT_IN_FILTER_KEY]).toEqual([
      'acc-1101',
      'acc-1001',
    ]);
    expect(filter[MEMBERSHIP_LEDGER_MODE_FILTER_KEY]).toBe('balance');
  });
});
