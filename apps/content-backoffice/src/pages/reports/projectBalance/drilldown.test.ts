import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONVERTED_FILTER,
  PROJECT_BALANCE_LEG_FILTER_KEY,
} from '../../../data/transactionList';
import { filterFromListSearch } from '../../../data/transactionListLocation';
import {
  buildTransactionsDrilldownUrl,
  drilldownForTablePeriodLeg,
  drilldownForTableCumulative,
} from './drilldown';

describe('buildTransactionsDrilldownUrl', () => {
  it('maps report filters onto the transaction list query', () => {
    const link = buildTransactionsDrilldownUrl({
      organizationId: 'org-a',
      currencyCode: 'HUF',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
      transactionStatus: 'preview',
      leg: 'revenue',
    });
    expect(link.pathname).toBe('/transactions');
    const filter = filterFromListSearch(link.search);
    expect(filter).toEqual({
      converted_to_workflow: [...DEFAULT_CONVERTED_FILTER],
      organization: 'org-a',
      currency_type: 'HUF',
      date_gte: '2026-11-01',
      date_lte: '2026-11-30',
      status: 'published',
      [PROJECT_BALANCE_LEG_FILTER_KEY]: 'revenue',
    });
  });

  it('omits date_gte and status for cumulative / all-publication modes', () => {
    const link = drilldownForTableCumulative(
      {
        range: 'thisMonth',
        transactionStatus: 'all',
        currencyCode: 'HUF',
        toolbarOrganizationId: null,
      },
      'org-b',
    );
    const filter = filterFromListSearch(link.search);
    expect(filter.date_gte).toBeUndefined();
    expect(filter.status).toBeUndefined();
    expect(String(filter.date_lte)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filter.organization).toBe('org-b');
  });

  it('builds period leg drill-down from toolbar context', () => {
    const link = drilldownForTablePeriodLeg(
      {
        range: 'last7',
        transactionStatus: 'draft',
        currencyCode: 'EUR',
        toolbarOrganizationId: 'ignored',
      },
      'org-c',
      'cost',
    );
    const filter = filterFromListSearch(link.search);
    expect(filter.status).toBe('draft');
    expect(filter[PROJECT_BALANCE_LEG_FILTER_KEY]).toBe('cost');
    expect(filter.currency_type).toBe('EUR');
  });
});
