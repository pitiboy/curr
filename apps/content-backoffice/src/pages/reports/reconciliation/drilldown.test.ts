import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONVERTED_FILTER,
  RECEIPT_LIKELY_REQUIRED_FILTER_KEY,
  RECEIPT_PRESENCE_FILTER_KEY,
} from '../../../data/transactionList';
import {
  buildDraftTransactionsDrilldown,
  buildPublishedWithoutReceiptsDrilldown,
} from './drilldown';

function parseFilter(search: string): Record<string, unknown> {
  const params = new URLSearchParams(search);
  const raw = params.get('filter');
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

describe('reconciliation drilldown', () => {
  it('opens draft transactions with the default converted filter', () => {
    const link = buildDraftTransactionsDrilldown();
    expect(link.pathname).toBe('/transactions');
    expect(parseFilter(link.search)).toEqual({
      status: 'draft',
      converted_to_workflow: [...DEFAULT_CONVERTED_FILTER],
    });
  });

  it('opens published rows without receipts', () => {
    const link = buildPublishedWithoutReceiptsDrilldown();
    expect(parseFilter(link.search)).toMatchObject({
      status: 'published',
      converted_to_workflow: [...DEFAULT_CONVERTED_FILTER],
      [RECEIPT_PRESENCE_FILTER_KEY]: 'none',
    });
  });

  it('passes account heuristic when configured', () => {
    const link = buildPublishedWithoutReceiptsDrilldown({
      creditCodes: ['1100'],
      debitCodes: ['5000', '54*'],
    });
    expect(parseFilter(link.search)).toMatchObject({
      [RECEIPT_PRESENCE_FILTER_KEY]: 'none',
      [RECEIPT_LIKELY_REQUIRED_FILTER_KEY]: {
        creditCodes: ['1100'],
        debitCodes: ['5000', '54*'],
      },
    });
  });
});
