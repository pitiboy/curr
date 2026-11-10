import { describe, expect, it } from 'vitest';

import {
  CREDIT_ACCOUNT_IN_FILTER_KEY,
  DEFAULT_CONVERTED_FILTER,
  PROJECT_BALANCE_LEG_FILTER_KEY,
} from '../data/transactionList';
import { filterFromListSearch } from '../data/transactionListLocation';
import { buildTransactionsDrilldownUrl } from '../pages/reports/projectBalance/drilldown';
import {
  applyMenuOverride,
  boundsFromGlobalFilters,
  clearOptionalFilter,
  menuModeForGlobalFilters,
  mergeDrilldownIntoGlobal,
  optionalFilterHasValue,
  REVIEW_CONVERTED_FILTER,
  resetGlobalFilters,
  selectDatePreset,
  setCustomDate,
  stableFilterKey,
  toListFilter,
  toReportParams,
  type GlobalTransactionFilters,
} from './globalTransactionFilters';

const NOW = new Date(2026, 10, 10); // 2026-11-10 local

describe('resetGlobalFilters', () => {
  it('defaults to this month, published books and none+expanded', () => {
    expect(resetGlobalFilters()).toEqual({
      datePreset: 'thisMonth',
      status: 'preview',
      converted_to_workflow: ['none', 'expanded'],
    });
  });

  it('returns a fresh converted array each time', () => {
    const a = resetGlobalFilters();
    a.converted_to_workflow.push('storno');
    expect(resetGlobalFilters().converted_to_workflow).toEqual([
      ...DEFAULT_CONVERTED_FILTER,
    ]);
  });
});

describe('boundsFromGlobalFilters', () => {
  it('maps presets to local calendar bounds', () => {
    expect(boundsFromGlobalFilters(resetGlobalFilters(), NOW)).toEqual({
      from: '2026-11-01',
      to: '2026-11-10',
    });
    expect(
      boundsFromGlobalFilters(
        { ...resetGlobalFilters(), datePreset: 'lastMonth' },
        NOW,
      ),
    ).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('uses custom date_* with an open start and today as the open end', () => {
    expect(
      boundsFromGlobalFilters(
        {
          ...resetGlobalFilters(),
          datePreset: 'custom',
          date_lte: '2026-05-01',
        },
        NOW,
      ),
    ).toEqual({ from: null, to: '2026-05-01' });
    expect(
      boundsFromGlobalFilters(
        {
          ...resetGlobalFilters(),
          datePreset: 'custom',
          date_gte: '2026-05-01',
        },
        NOW,
      ),
    ).toEqual({ from: '2026-05-01', to: '2026-11-10' });
  });
});

describe('toListFilter', () => {
  it('maps preview to published and the preset to date bounds', () => {
    expect(toListFilter(resetGlobalFilters(), NOW)).toEqual({
      date_gte: '2026-11-01',
      date_lte: '2026-11-10',
      status: 'published',
      converted_to_workflow: ['none', 'expanded'],
    });
  });

  it('omits status for all and dates for the all preset', () => {
    const filter = toListFilter(
      { ...resetGlobalFilters(), status: 'all', datePreset: 'all' },
      NOW,
    );
    expect(filter).toEqual({ converted_to_workflow: ['none', 'expanded'] });
  });

  it('passes optional fields and drill-down keys through', () => {
    const filter = toListFilter(
      {
        ...resetGlobalFilters(),
        status: 'draft',
        datePreset: 'custom',
        date_gte: '2026-01-01',
        amount_gte: 0,
        amount_lte: 500,
        createdAt_gte: '2026-02-01',
        organization: 'org-1',
        debit_account: 'acc-d',
        credit_account: 'acc-c',
        description: 'tojás',
        vendor: '  ',
        drilldown: { currency_type: 'HUF' },
      },
      NOW,
    );
    expect(filter).toEqual({
      date_gte: '2026-01-01',
      status: 'draft',
      converted_to_workflow: ['none', 'expanded'],
      amount_gte: 0,
      amount_lte: 500,
      createdAt_gte: '2026-02-01',
      organization: 'org-1',
      debit_account: 'acc-d',
      credit_account: 'acc-c',
      description: 'tojás',
      currency_type: 'HUF',
    });
  });
});

describe('toReportParams', () => {
  it('passes presets and status through', () => {
    const params = toReportParams(
      { ...resetGlobalFilters(), status: 'draft' },
      NOW,
    );
    expect(params.preset).toBe('thisMonth');
    expect(params.bounds).toEqual({ from: '2026-11-01', to: '2026-11-10' });
    expect(params.transactionStatus).toBe('draft');
  });

  it('maps custom ranges to a granularity preset by span', () => {
    const short = toReportParams(
      {
        ...resetGlobalFilters(),
        datePreset: 'custom',
        date_gte: '2026-10-01',
        date_lte: '2026-10-20',
      },
      NOW,
    );
    expect(short.preset).toBe('thisMonth');
    expect(short.bounds).toEqual({ from: '2026-10-01', to: '2026-10-20' });
    const long = toReportParams(
      {
        ...resetGlobalFilters(),
        datePreset: 'custom',
        date_gte: '2025-01-01',
        date_lte: '2026-10-20',
      },
      NOW,
    );
    expect(long.preset).toBe('thisYear');
    const open = toReportParams(
      { ...resetGlobalFilters(), datePreset: 'custom', date_lte: '2026-10-20' },
      NOW,
    );
    expect(open.preset).toBe('all');
    expect(short.key).not.toBe(long.key);
  });
});

describe('date UX', () => {
  it('preset selection clears custom dates', () => {
    const next = selectDatePreset(
      {
        ...resetGlobalFilters(),
        datePreset: 'custom',
        date_gte: '2026-01-01',
        date_lte: '2026-02-01',
      },
      'last7',
    );
    expect(next.datePreset).toBe('last7');
    expect(next.date_gte).toBeUndefined();
    expect(next.date_lte).toBeUndefined();
  });

  it('custom date edit switches to custom, seeded from the active preset', () => {
    const next = setCustomDate(
      resetGlobalFilters(),
      'date_lte',
      '2026-11-05',
      NOW,
    );
    expect(next).toMatchObject({
      datePreset: 'custom',
      date_gte: '2026-11-01',
      date_lte: '2026-11-05',
    });
    const cleared = setCustomDate(next, 'date_gte', '', NOW);
    expect(cleared.date_gte).toBeUndefined();
    expect(cleared.datePreset).toBe('custom');
  });

  it('clearing the custom date filter returns to the default preset', () => {
    const state = setCustomDate(resetGlobalFilters(), 'date_gte', '2026-01-01');
    expect(optionalFilterHasValue(state, 'date')).toBe(true);
    const cleared = clearOptionalFilter(state, 'date');
    expect(cleared.datePreset).toBe('thisMonth');
    expect(optionalFilterHasValue(cleared, 'date')).toBe(false);
  });
});

describe('applyMenuOverride', () => {
  const custom: GlobalTransactionFilters = {
    datePreset: 'custom',
    date_gte: '2026-01-01',
    date_lte: '2026-03-31',
    status: 'preview',
    converted_to_workflow: ['none'],
    amount_gte: 10,
    organization: 'org-1',
    debit_account: 'acc-d',
    credit_account: 'acc-c',
    description: 'x',
    vendor: 'y',
    createdAt_lte: '2026-04-01',
    drilldown: { currency_type: 'HUF' },
  };

  it('Review sets draft + every deal expansion and keeps the date and other fields', () => {
    const next = applyMenuOverride(custom, 'draft');
    expect(next.status).toBe('draft');
    expect(next.converted_to_workflow).toEqual(REVIEW_CONVERTED_FILTER);
    expect(next).toMatchObject({
      datePreset: 'custom',
      date_gte: '2026-01-01',
      date_lte: '2026-03-31',
      amount_gte: 10,
      organization: 'org-1',
      debit_account: 'acc-d',
      credit_account: 'acc-c',
      description: 'x',
      vendor: 'y',
      createdAt_lte: '2026-04-01',
    });
    expect(next.drilldown).toBeUndefined();
    expect(menuModeForGlobalFilters(next)).toBe('draft');
  });

  it('Transactions replaces a draft status with all + none/expanded', () => {
    const draft = applyMenuOverride(
      { ...resetGlobalFilters(), datePreset: 'lastMonth' },
      'draft',
    );
    const all = applyMenuOverride(draft, 'all');
    expect(all.status).toBe('all');
    expect(all.converted_to_workflow).toEqual(['none', 'expanded']);
    expect(all.datePreset).toBe('lastMonth');
    expect(menuModeForGlobalFilters(all)).toBe('all');
  });
});

describe('mergeDrilldownIntoGlobal', () => {
  it('moves a project balance drill-down into the atom', () => {
    const link = buildTransactionsDrilldownUrl({
      organizationId: 'org-a',
      currencyCode: 'HUF',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
      transactionStatus: 'preview',
      leg: 'revenue',
    });
    const before: GlobalTransactionFilters = {
      ...resetGlobalFilters(),
      status: 'all',
      credit_account: 'stale',
      vendor: 'kept',
      drilldown: { old: true },
    };
    const next = mergeDrilldownIntoGlobal(
      before,
      filterFromListSearch(link.search),
    );
    expect(next).toEqual({
      datePreset: 'custom',
      date_gte: '2026-11-01',
      date_lte: '2026-11-30',
      status: 'preview',
      converted_to_workflow: [...DEFAULT_CONVERTED_FILTER],
      organization: 'org-a',
      vendor: 'kept',
      drilldown: {
        currency_type: 'HUF',
        [PROJECT_BALANCE_LEG_FILTER_KEY]: 'revenue',
      },
    });
    expect(toListFilter(next)).toEqual({
      ...filterFromListSearch(link.search),
      vendor: 'kept',
    });
  });

  it('keeps an open start and maps a missing status to all', () => {
    const next = mergeDrilldownIntoGlobal(resetGlobalFilters(), {
      date_lte: '2026-11-30',
      converted_to_workflow: ['none', 'expanded', 'original'],
      [CREDIT_ACCOUNT_IN_FILTER_KEY]: ['a', 'b'],
    });
    expect(next.datePreset).toBe('custom');
    expect(next.date_gte).toBeUndefined();
    expect(next.status).toBe('all');
    expect(next.converted_to_workflow).toEqual([
      'none',
      'expanded',
      'original',
    ]);
    expect(next.drilldown).toEqual({
      [CREDIT_ACCOUNT_IN_FILTER_KEY]: ['a', 'b'],
    });
  });

  it('round-trips through toListFilter', () => {
    const state: GlobalTransactionFilters = {
      datePreset: 'custom',
      date_gte: '2026-01-01',
      date_lte: '2026-01-31',
      status: 'draft',
      converted_to_workflow: ['storno'],
      amount_gte: 5,
      description: 'abc',
    };
    const filter = toListFilter(state);
    expect(
      stableFilterKey(
        toListFilter(mergeDrilldownIntoGlobal(resetGlobalFilters(), filter)),
      ),
    ).toBe(stableFilterKey(filter));
  });
});

describe('stableFilterKey', () => {
  it('ignores key order', () => {
    expect(stableFilterKey({ a: 1, b: [2] })).toBe(
      stableFilterKey({ b: [2], a: 1 }),
    );
  });
});
