import { describe, expect, it, vi } from 'vitest';

import {
  attachReceiptToTransaction,
  createReceiptDraft,
  receiptDocumentUrl,
  receiptDraftBody,
  receiptIsPresent,
} from './receiptDraft';

const file = new File(['pdf'], 'szamla.pdf', { type: 'application/pdf' });

describe('receiptDraftBody', () => {
  it('prefills date, amount, and description and keeps an empty vendor off the payload', () => {
    expect(
      receiptDraftBody({
        date: '2026-10-14',
        amount: 1500,
        description: '  papír  ',
        vendor: '   ',
        document: 7,
      }),
    ).toEqual({
      date: '2026-10-14T00:00:00.000Z',
      amount: 1500,
      description: 'papír',
      document: 7,
    });
  });

  it('sends a trimmed vendor when one was typed', () => {
    expect(
      receiptDraftBody({
        date: '2026-10-14T08:30:00.000Z',
        amount: '20',
        description: 'papír',
        vendor: '  Bolt  ',
        document: 'file-doc',
      }),
    ).toEqual({
      date: '2026-10-14T08:30:00.000Z',
      amount: '20',
      description: 'papír',
      vendor: 'Bolt',
      document: 'file-doc',
    });
  });

  it('rejects a file attachment that has no description', () => {
    expect(() =>
      receiptDraftBody({
        date: '2026-10-14',
        amount: 10,
        description: '  ',
        vendor: '',
        document: 1,
      }),
    ).toThrow(/description/i);
  });
});

describe('createReceiptDraft', () => {
  it('uploads with the files field, then creates a draft receipt', async () => {
    const httpClient = vi
      .fn()
      .mockResolvedValueOnce({
        json: [{ id: 7, documentId: 'file-1', url: 'https://cdn.example/szamla.pdf' }],
      })
      .mockResolvedValueOnce({
        json: { data: { documentId: 'receipt-9' } },
      });

    const receiptId = await createReceiptDraft(
      httpClient,
      'http://localhost:1337',
      {
        file,
        vendor: '',
        date: '2026-10-14',
        amount: 1500,
        description: 'papír',
      },
    );

    expect(receiptId).toBe('receipt-9');
    expect(httpClient).toHaveBeenNthCalledWith(
      1,
      'http://localhost:1337/api/upload',
      expect.objectContaining({ method: 'POST' }),
    );
    const uploadBody = httpClient.mock.calls[0]?.[1]?.body;
    expect(uploadBody).toBeInstanceOf(FormData);
    expect((uploadBody as FormData).get('files')).toBe(file);
    expect(httpClient).toHaveBeenNthCalledWith(
      2,
      'http://localhost:1337/api/receipts?status=draft',
      {
        method: 'POST',
        body: JSON.stringify({
          data: {
            date: '2026-10-14T00:00:00.000Z',
            amount: 1500,
            description: 'papír',
            document: 7,
          },
        }),
      },
    );
  });

  it('does not upload when the description is missing', async () => {
    const httpClient = vi.fn();
    await expect(
      createReceiptDraft(httpClient, 'http://localhost:1337', {
        file,
        vendor: '',
        date: '2026-10-14',
        amount: 1500,
        description: '',
      }),
    ).rejects.toThrow(/description/i);
    expect(httpClient).not.toHaveBeenCalled();
  });
});

describe('attachReceiptToTransaction', () => {
  it('stores the receipt documentId on the draft transaction', async () => {
    const httpClient = vi
      .fn()
      .mockResolvedValueOnce({ json: [{ id: 4 }] })
      .mockResolvedValueOnce({ json: { data: { documentId: 'receipt-4' } } })
      .mockResolvedValueOnce({ json: { data: { documentId: 'tx-1' } } });

    const receiptId = await attachReceiptToTransaction(
      httpClient,
      'http://localhost:1337',
      'tx-1',
      {
        file,
        vendor: 'Bolt',
        date: '2026-10-14',
        amount: 10,
        description: 'papír',
      },
    );

    expect(receiptId).toBe('receipt-4');
    expect(httpClient).toHaveBeenLastCalledWith(
      'http://localhost:1337/api/transactions/tx-1?status=draft',
      {
        method: 'PUT',
        body: JSON.stringify({ data: { receipt: 'receipt-4' } }),
      },
    );
  });
});

describe('receiptDocumentUrl', () => {
  it('returns an absolute file url and prefixes a relative one', () => {
    expect(
      receiptDocumentUrl(
        { documentId: 'r1', document: { url: 'https://cdn.example/a.pdf' } },
        'http://localhost:1337',
      ),
    ).toBe('https://cdn.example/a.pdf');
    expect(
      receiptDocumentUrl(
        { documentId: 'r1', document: [{ url: '/uploads/a.pdf' }] },
        'http://localhost:1337/',
      ),
    ).toBe('http://localhost:1337/uploads/a.pdf');
    expect(receiptDocumentUrl({ documentId: 'r1' }, 'http://localhost:1337')).toBe(
      null,
    );
    expect(receiptIsPresent({ documentId: 'r1' })).toBe(true);
    expect(receiptIsPresent(null)).toBe(false);
  });
});
