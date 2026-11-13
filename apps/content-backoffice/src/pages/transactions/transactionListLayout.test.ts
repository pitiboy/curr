import { describe, expect, it } from 'vitest';

import {
  TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS,
  transactionListFooterMinWidth,
  transactionListScrollMaxHeight,
} from './transactionListLayout';

describe('transactionListFooterMinWidth', () => {
  it('keeps full table width so mobile can scroll every column', () => {
    expect(transactionListFooterMinWidth(true, false)).toBe('52rem');
    expect(transactionListFooterMinWidth(true, true)).toBe('55rem');
  });

  it('keeps the desktop table width', () => {
    expect(transactionListFooterMinWidth(false, false)).toBe('52rem');
    expect(transactionListFooterMinWidth(false, true)).toBe('55rem');
  });
});

describe('TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS', () => {
  it('defaults to empty so all columns remain visible on mobile', () => {
    expect(TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS).toEqual([]);
  });
});

describe('transactionListScrollMaxHeight', () => {
  it('uses a taller viewport budget on mobile', () => {
    expect(transactionListScrollMaxHeight(true)).toBe('calc(100dvh - 10.5rem)');
    expect(transactionListScrollMaxHeight(false)).toBe('calc(100dvh - 12rem)');
  });
});
