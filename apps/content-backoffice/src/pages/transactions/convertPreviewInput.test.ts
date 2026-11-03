import { describe, expect, it } from 'vitest';

import {
  inlinePreviewFromCreateForm,
  normalizeCreateFormAmount,
  normalizeCreateFormDate,
} from './convertPreviewInput';

describe('normalizeCreateFormDate', () => {
  it('formats Date instances as ISO calendar dates', () => {
    expect(normalizeCreateFormDate(new Date(2026, 10, 3))).toBe('2026-11-03');
  });

  it('keeps ISO strings', () => {
    expect(normalizeCreateFormDate('2026-11-03')).toBe('2026-11-03');
  });
});

describe('normalizeCreateFormAmount', () => {
  it('parses numbers and localized strings', () => {
    expect(normalizeCreateFormAmount(10)).toBe(10);
    expect(normalizeCreateFormAmount('1 234,5')).toBe(1234.5);
  });
});

describe('inlinePreviewFromCreateForm', () => {
  it('builds inline payload when date is a Date object', () => {
    const result = inlinePreviewFromCreateForm(
      {
        date: new Date(2026, 10, 3),
        amount: 10,
        debit_account: 'debit-id',
        credit_account: 'credit-id',
        currency_type: 'cur-id',
      },
      [],
    );
    expect(result?.date).toBe('2026-11-03');
    expect(result?.amount).toBe(10);
  });
});
