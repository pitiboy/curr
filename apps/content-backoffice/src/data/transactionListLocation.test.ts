import { parse } from 'query-string';
import { describe, expect, it } from 'vitest';

import {
  filterFromListSearch,
  transactionListMode,
  transactionsMenuTo,
} from './transactionListLocation';

function filterAsReactAdmin(search: string): Record<string, unknown> {
  const query = parse(search);
  const raw = query.filter;
  if (typeof raw !== 'string') return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('transactionsMenuTo', () => {
  it('opens Review on the shared list with only the draft status', () => {
    const target = transactionsMenuTo('draft');
    expect(target.pathname).toBe('/transactions');
    expect(filterFromListSearch(target.search)).toEqual({ status: 'draft' });
    expect(filterAsReactAdmin(target.search)).toEqual({ status: 'draft' });
    expect(target.search).not.toContain('/transactions/review');
  });

  it('opens Transactions with an empty filter that replaces a stored draft', () => {
    const draft = transactionsMenuTo('draft');
    const all = transactionsMenuTo('all');
    expect(filterFromListSearch(draft.search)).toEqual({ status: 'draft' });
    expect(filterFromListSearch(all.search)).toEqual({});
    expect(filterAsReactAdmin(all.search)).toEqual({});
    expect(all.pathname).toBe(draft.pathname);
    expect(all.search).not.toBe(draft.search);
  });

  it('highlights Review only while the list filter status is draft', () => {
    const draft = transactionsMenuTo('draft');
    const all = transactionsMenuTo('all');
    expect(transactionListMode(draft.pathname, draft.search)).toBe('draft');
    expect(transactionListMode(all.pathname, all.search)).toBe('all');
    expect(
      transactionListMode(
        '/transactions',
        '?filter={"status":"draft","date_gte":"2026-01-01"}',
      ),
    ).toBe('draft');
    expect(transactionListMode('/transactions/create', all.search)).toBeNull();
  });
});
