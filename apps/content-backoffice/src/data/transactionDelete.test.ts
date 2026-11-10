import { describe, expect, it, vi } from 'vitest';

import {
  deleteTransactionRow,
  purgeTransactionExpansion,
  transactionDeleteUrl,
  transactionPurgeExpansionUrl,
} from './transactionDelete';

describe('transaction delete urls', () => {
  it('targets the core delete and purge-expansion routes', () => {
    expect(transactionDeleteUrl('http://localhost:1337', 'doc-abc')).toBe(
      'http://localhost:1337/api/transactions/doc-abc',
    );
    expect(
      transactionPurgeExpansionUrl('http://localhost:1337', 'doc-abc'),
    ).toBe(
      'http://localhost:1337/api/transactions/doc-abc/actions/purge-expansion',
    );
  });
});

describe('deleteTransactionRow', () => {
  it('sends DELETE', async () => {
    const httpClient = vi.fn().mockResolvedValue({ json: {} });
    await deleteTransactionRow(httpClient, 'http://localhost:1337', 'doc-abc');
    expect(httpClient).toHaveBeenCalledWith(
      'http://localhost:1337/api/transactions/doc-abc',
      { method: 'DELETE' },
    );
  });
});

describe('purgeTransactionExpansion', () => {
  it('POSTs with an empty JSON body', async () => {
    const httpClient = vi.fn().mockResolvedValue({ json: {} });
    await purgeTransactionExpansion(
      httpClient,
      'http://localhost:1337',
      'orig-1',
    );
    expect(httpClient).toHaveBeenCalledWith(
      'http://localhost:1337/api/transactions/orig-1/actions/purge-expansion',
      { method: 'POST', body: JSON.stringify({}) },
    );
  });
});
