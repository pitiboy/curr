import { describe, expect, it } from 'vitest';

import {
  filterFromListSearch,
  transactionListMode,
} from './transactionListLocation';

describe('filterFromListSearch', () => {
  it('parses the React Admin filter param', () => {
    const params = new URLSearchParams();
    params.set('filter', JSON.stringify({ status: 'draft' }));
    expect(filterFromListSearch(`?${params.toString()}`)).toEqual({
      status: 'draft',
    });
  });

  it('returns an empty filter for missing or invalid JSON', () => {
    expect(filterFromListSearch('')).toEqual({});
    expect(filterFromListSearch('?filter=%5B1%5D')).toEqual({});
    expect(filterFromListSearch('?filter=nope')).toEqual({});
  });
});

describe('transactionListMode', () => {
  it('highlights Review only on the list while the global status is draft', () => {
    expect(transactionListMode('/transactions', 'draft')).toBe('draft');
    expect(transactionListMode('/transactions', 'all')).toBe('all');
    expect(transactionListMode('/transactions', 'preview')).toBe('all');
    expect(transactionListMode('/transactions/create', 'draft')).toBeNull();
    expect(transactionListMode('/reports/egg-inventory', 'all')).toBeNull();
  });
});
