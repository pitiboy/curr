import { describe, expect, it, vi } from 'vitest';

import {
  createTransactionDraft,
  transactionDraftBody,
  transactionDraftUrl,
} from './transactionDraft';

describe('transactionDraftBody', () => {
  it('sends the create fields and drops audit and workflow relations', () => {
    expect(
      transactionDraftBody({
        date: '2026-10-14',
        amount: 1500,
        description: '  papír  ',
        organization: 'org-1',
        debit_account: 'debit-1',
        credit_account: 'credit-1',
        currency_type: 'currency-1',
        entered_by: 'someone@example.com',
        published_by: 'editor@example.com',
        transaction_type: 'type-1',
        related_transaction: 'tx-1',
        receipt: 'receipt-1',
        status: 'published',
      }),
    ).toEqual({
      date: '2026-10-14',
      amount: 1500,
      description: 'papír',
      organization: 'org-1',
      debit_account: 'debit-1',
      credit_account: 'credit-1',
      currency_type: 'currency-1',
    });
  });

  it('omits an empty description', () => {
    expect(
      transactionDraftBody({
        date: '2026-10-14T12:00:00.000Z',
        amount: '20',
        description: '   ',
        organization: 'org-1',
        debit_account: 'debit-1',
        credit_account: 'credit-1',
      }),
    ).toEqual({
      date: '2026-10-14',
      amount: '20',
      organization: 'org-1',
      debit_account: 'debit-1',
      credit_account: 'credit-1',
    });
  });
});

describe('createTransactionDraft', () => {
  it('posts to the draft status query', async () => {
    const httpClient = vi.fn(async () => ({
      json: { data: { documentId: 'doc-new', amount: 1500 } },
    }));

    const result = await createTransactionDraft(
      httpClient,
      'http://localhost:1337',
      {
        date: '2026-10-14',
        amount: 1500,
        organization: 'org-1',
        debit_account: 'debit-1',
        credit_account: 'credit-1',
        entered_by: 'ignored@example.com',
      },
    );

    expect(httpClient).toHaveBeenCalledWith(
      transactionDraftUrl('http://localhost:1337'),
      {
        method: 'POST',
        body: JSON.stringify({
          data: {
            date: '2026-10-14',
            amount: 1500,
            organization: 'org-1',
            debit_account: 'debit-1',
            credit_account: 'credit-1',
          },
        }),
      },
    );
    expect(transactionDraftUrl('http://localhost:1337')).toBe(
      'http://localhost:1337/api/transactions?status=draft',
    );
    expect(result.data.id).toBe('doc-new');
    expect(result.data.documentId).toBe('doc-new');
  });
});
