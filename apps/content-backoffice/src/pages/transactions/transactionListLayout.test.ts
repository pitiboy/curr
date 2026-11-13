import { describe, expect, it } from 'vitest';

import {
  TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS,
  transactionListFooterMinWidth,
} from './transactionListLayout';

describe('transactionListFooterMinWidth', () => {
  it('uses a narrow scroll width on mobile', () => {
    expect(transactionListFooterMinWidth(true, false)).toBe('27rem');
    expect(transactionListFooterMinWidth(true, true)).toBe('30rem');
  });

  it('keeps the desktop table width', () => {
    expect(transactionListFooterMinWidth(false, false)).toBe('52rem');
  });
});

describe('TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS', () => {
  it('hides audit and wide account columns but keeps core ledger fields', () => {
    expect(TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS).not.toContain('date');
    expect(TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS).not.toContain('amount');
    expect(TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS).toContain('entryId');
    expect(TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS).toContain('debit');
  });
});
