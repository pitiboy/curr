import { describe, expect, it } from 'vitest';

import {
  CREDIT_ACCOUNT_IN_FILTER_KEY,
  DEFAULT_CONVERTED_FILTER,
  MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY,
} from '../../../data/transactionList';
import { MEMBERSHIP_SHARE_DRILLDOWN_CONVERTED_FILTER } from './drilldown';
import { filterFromListSearch } from '../../../data/transactionListLocation';
import { MEMBER_SHARE_ACCOUNT_CODE } from './types';
import { drilldownForMemberCell, drilldownForPieSlice } from './drilldown';

describe('MEMBERSHIP_SHARE_DRILLDOWN_CONVERTED_FILTER', () => {
  it('matches the report cohort (none + expanded, no original / storno)', () => {
    expect(MEMBERSHIP_SHARE_DRILLDOWN_CONVERTED_FILTER).toEqual([
      ...DEFAULT_CONVERTED_FILTER,
    ]);
    expect(MEMBERSHIP_SHARE_DRILLDOWN_CONVERTED_FILTER).not.toContain(
      'original',
    );
    expect(MEMBERSHIP_SHARE_DRILLDOWN_CONVERTED_FILTER).not.toContain('storno');
  });
});

describe('membershipShare drilldown', () => {
  const context = {
    range: 'thisMonth' as const,
    transactionStatus: 'preview' as const,
    focus: 'both' as const,
  };

  const member = {
    memberId: 'm-1',
    memberName: 'Teszt',
    shareAccountId: 'acc-1101',
    pocketAccountId: 'acc-1001',
    shareByCurrency: [{ currency: 'HUF', amount: 1000 }],
    pocketByCurrency: [],
  };

  it('maps member cell to credit account and external filter', () => {
    const link = drilldownForMemberCell(context, member, 'HUF', 'share');
    const filter = filterFromListSearch(link.search);
    expect(filter).toMatchObject({
      converted_to_workflow: [...MEMBERSHIP_SHARE_DRILLDOWN_CONVERTED_FILTER],
      currency_type: 'HUF',
      credit_account: 'acc-1101',
      status: 'published',
      [MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY]: true,
    });
    expect(filter.date_gte).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filter.date_lte).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('maps pie share slice to 1101 code filter', () => {
    const link = drilldownForPieSlice(context, 'share', 'HUF');
    const filter = filterFromListSearch(link.search);
    expect(filter.credit_account_code).toBe(MEMBER_SHARE_ACCOUNT_CODE);
    expect(filter[CREDIT_ACCOUNT_IN_FILTER_KEY]).toBeUndefined();
  });
});
