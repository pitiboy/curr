import { describe, expect, it, vi } from 'vitest';

import {
  appliedRateLabelParts,
  memberRatioLabelParts,
  convertPreviewUrl,
  fetchConvertPreview,
} from './convertPreview';

describe('memberRatioLabelParts', () => {
  it('formats ratio with Hungarian decimals and the membership name', () => {
    expect(
      memberRatioLabelParts({
        ratio: 0.75,
        membershipDocumentId: 'm',
        membershipName: 'Érdeklődő',
        source: 'membership_type',
      }),
    ).toEqual({ ratio: '0,75', membership: 'Érdeklődő' });
  });

  it('returns null without a ratio and a dash without a name', () => {
    expect(memberRatioLabelParts(null)).toBeNull();
    expect(
      memberRatioLabelParts({
        ratio: 0.5,
        membershipDocumentId: null,
        membershipName: null,
        source: 'membership',
      })?.membership,
    ).toBe('—');
  });
});

describe('appliedRateLabelParts', () => {
  it('formats rate and valid-from day', () => {
    expect(
      appliedRateLabelParts({
        fromCurrencyDocumentId: 'egg',
        toCurrencyDocumentId: 'huf',
        rate: 100,
        validFrom: '2023-01-01T00:00:00.000Z',
        currencyRateDocumentId: 'r',
      }),
    ).toEqual({ rate: '100', validFrom: '2023-01-01' });
  });

  it('returns null without a rate and keeps validFrom null for same currency', () => {
    expect(appliedRateLabelParts(null)).toBeNull();
    expect(appliedRateLabelParts(undefined)).toBeNull();
    expect(
      appliedRateLabelParts({
        fromCurrencyDocumentId: 'huf',
        toCurrencyDocumentId: 'huf',
        rate: 1,
        validFrom: null,
        currencyRateDocumentId: null,
      }),
    ).toEqual({ rate: '1', validFrom: null });
  });
});

describe('convertPreviewUrl', () => {
  it('targets the convert-preview route', () => {
    expect(convertPreviewUrl('http://localhost:1337')).toBe(
      'http://localhost:1337/api/transaction-workflows/convert-preview',
    );
  });
});

describe('fetchConvertPreview', () => {
  it('posts saved transaction documentId', async () => {
    const httpClient = vi.fn().mockResolvedValue({
      json: {
        data: {
          workflow: {
            documentId: 'wf',
            name: 'W',
            keepOriginal: true,
            stepsPublished: true,
          },
          original: {
            amount: 1,
            currency: { documentId: 'c', code: 'HUF', name: null },
            debit: { documentId: 'd', code: '1', name: null },
            credit: { documentId: 'cr', code: '2', name: null },
            description: '',
          },
          movements: [],
          warnings: [],
        },
      },
    });
    await fetchConvertPreview(httpClient, 'http://localhost:1337', {
      workflowDocumentId: 'wf',
      transactionDocumentId: 'tx',
    });
    expect(httpClient).toHaveBeenCalledWith(
      'http://localhost:1337/api/transaction-workflows/convert-preview',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          workflowDocumentId: 'wf',
          transactionDocumentId: 'tx',
        }),
      }),
    );
  });

  it('posts inline transaction payload for create form', async () => {
    const httpClient = vi.fn().mockResolvedValue({
      json: { data: null, error: { message: 'fail', status: 422 } },
    });
    await expect(
      fetchConvertPreview(httpClient, 'http://localhost:1337', {
        workflowDocumentId: 'wf',
        transaction: {
          date: '2026-01-01',
          amount: 100,
          debit_account: { documentId: 'd' },
          credit_account: { documentId: 'c' },
          currency_type: { documentId: 'cur' },
        },
      }),
    ).rejects.toThrow('fail');
  });
});
