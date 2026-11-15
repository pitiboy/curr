import { describe, expect, it } from 'vitest';

import {
  transactionOptionLabel,
  transactionPickerFilters,
} from './transactionPicker';

describe('transactionPickerFilters', () => {
  it('suggests 1500 debit rows for an empty acquisition search', () => {
    const { $and } = transactionPickerFilters('  ', 'debit') as {
      $and: unknown[];
    };
    expect($and).toContainEqual({
      debit_account: { code: { $eq: '1500' } },
    });
  });

  it('suggests 1500 credit rows for an empty disposal search', () => {
    const { $and } = transactionPickerFilters('', 'credit') as {
      $and: unknown[];
    };
    expect($and).toContainEqual({
      credit_account: { code: { $eq: '1500' } },
    });
  });

  it('searches description / documentId, and amount for numbers', () => {
    const { $and } = transactionPickerFilters('125 000', 'debit') as {
      $and: Array<Record<string, unknown>>;
    };
    expect($and[$and.length - 1]).toEqual({
      $or: [
        { description: { $containsi: '125 000' } },
        { documentId: { $eq: '125 000' } },
        { amount: { $eq: 125000 } },
      ],
    });
    const text = transactionPickerFilters('traktor', 'debit') as {
      $and: Array<Record<string, unknown>>;
    };
    expect(JSON.stringify(text)).not.toContain('"amount"');
  });
});

describe('transactionOptionLabel', () => {
  it('joins date, amount + currency and description', () => {
    expect(
      transactionOptionLabel({
        documentId: 'tx',
        date: '2026-01-02',
        amount: '1000',
        description: 'Traktor',
        currency_type: { code: 'HUF' },
      }),
    ).toBe('2026-01-02 · 1000 HUF · Traktor');
  });
});
