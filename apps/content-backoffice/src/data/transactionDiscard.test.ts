import { describe, expect, it, vi } from 'vitest';

import {
  discardTransactionDraft,
  transactionDiscardDraftUrl,
} from './transactionDiscard';

describe('transactionDiscardDraftUrl', () => {
  it('targets the discard-draft action route', () => {
    expect(transactionDiscardDraftUrl('http://localhost:1337', 'doc-abc')).toBe(
      'http://localhost:1337/api/transactions/doc-abc/actions/discard-draft',
    );
  });
});

describe('discardTransactionDraft', () => {
  it('POSTs with an empty JSON body', async () => {
    const httpClient = vi.fn().mockResolvedValue({ json: {} });
    await discardTransactionDraft(
      httpClient,
      'http://localhost:1337',
      'doc-abc',
    );
    expect(httpClient).toHaveBeenCalledWith(
      'http://localhost:1337/api/transactions/doc-abc/actions/discard-draft',
      { method: 'POST', body: JSON.stringify({}) },
    );
  });
});
