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
      transaction_type: 'type-1',
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

  it('creates the transaction first, then one receipt per file', async () => {
    const file = new File(['pdf'], 'szamla.pdf', { type: 'application/pdf' });
    const httpClient = vi
      .fn()
      .mockResolvedValueOnce({
        json: { data: { documentId: 'doc-new', amount: 1500 } },
      })
      .mockResolvedValueOnce({ json: [{ id: 7, documentId: 'file-1' }] })
      .mockResolvedValueOnce({ json: { data: { documentId: 'receipt-9' } } });

    const result = await createTransactionDraft(
      httpClient,
      'http://localhost:1337',
      {
        date: '2026-10-14',
        amount: 1500,
        description: 'papír',
        organization: 'org-1',
        debit_account: 'debit-1',
        credit_account: 'credit-1',
        receipt_cards: [
          { file, vendor: '  Bolt  ', receiptTypeId: 'type-1' },
          { file: null, vendor: '', receiptTypeId: '' },
        ],
        receipt: 'forged-receipt',
        entered_by: 'ignored@example.com',
      },
    );

    expect(httpClient.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:1337/api/transactions?status=draft',
      'http://localhost:1337/api/upload',
      'http://localhost:1337/api/receipts?status=draft',
    ]);
    expect(JSON.parse(String(httpClient.mock.calls[0]?.[1]?.body))).toEqual({
      data: {
        date: '2026-10-14',
        amount: 1500,
        description: 'papír',
        organization: 'org-1',
        debit_account: 'debit-1',
        credit_account: 'credit-1',
      },
    });
    expect(JSON.parse(String(httpClient.mock.calls[2]?.[1]?.body))).toEqual({
      data: {
        date: '2026-10-14T00:00:00.000Z',
        amount: 1500,
        description: 'papír',
        vendor: 'Bolt',
        document: 7,
        receipt_type: 'type-1',
        transaction: 'doc-new',
      },
    });
    expect(result.data.id).toBe('doc-new');
  });

  it('does not create a transaction when the receipt file has no description', async () => {
    const httpClient = vi.fn();
    await expect(
      createTransactionDraft(httpClient, 'http://localhost:1337', {
        date: '2026-10-14',
        amount: 1500,
        description: '   ',
        receipt_cards: [
          {
            file: new File(['pdf'], 'szamla.pdf', { type: 'application/pdf' }),
            vendor: 'Bolt',
            receiptTypeId: 'type-1',
          },
        ],
      }),
    ).rejects.toThrow(/description/i);
    expect(httpClient).not.toHaveBeenCalled();
  });

  it('does not create a transaction when a file has no vendor', async () => {
    const httpClient = vi.fn();
    await expect(
      createTransactionDraft(httpClient, 'http://localhost:1337', {
        date: '2026-10-14',
        amount: 1500,
        description: 'papír',
        receipt_cards: [
          {
            file: new File(['pdf'], 'szamla.pdf', { type: 'application/pdf' }),
            vendor: '  ',
            receiptTypeId: 'type-1',
          },
        ],
      }),
    ).rejects.toThrow(/vendor/i);
    expect(httpClient).not.toHaveBeenCalled();
  });
});
