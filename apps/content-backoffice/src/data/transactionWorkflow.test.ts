import { describe, expect, it } from 'vitest';

import {
  convertTransaction,
  fetchPublishedWorkflows,
  transactionWorkflowConvertUrl,
} from './transactionWorkflow';

describe('transactionWorkflowConvertUrl', () => {
  it('targets the custom convert route', () => {
    expect(transactionWorkflowConvertUrl('http://localhost:1337')).toBe(
      'http://localhost:1337/api/transaction-workflows/convert',
    );
  });
});

describe('fetchPublishedWorkflows', () => {
  it('requests published templates with currency and type populated', async () => {
    const seen: string[] = [];
    const rows = await fetchPublishedWorkflows(
      async (url) => {
        seen.push(url);
        return {
          json: {
            data: [
              {
                documentId: 'wf-1',
                name: 'Ügylet 1',
                debit_account_code: 1520,
                credit_account_code: 1101,
                currency_type: { documentId: 'cur-kor' },
              },
            ],
            meta: { pagination: { pageCount: 1 } },
          },
        };
      },
      'http://localhost:1337',
    );
    expect(seen).toHaveLength(1);
    const params = new URL(seen[0]!).searchParams;
    expect(params.get('status')).toBe('published');
    expect(
      params.get('populate[currency_type][fields][0]'),
    ).toBe('documentId');
    expect(rows).toEqual([
      {
        documentId: 'wf-1',
        name: 'Ügylet 1',
        debit_account_code: 1520,
        credit_account_code: 1101,
        currency_type: { documentId: 'cur-kor' },
        transaction_type: null,
      },
    ]);
  });
});

describe('convertTransaction', () => {
  it('posts document ids without steps_published override', async () => {
    let seen: { url: string; method?: string; body?: string } | undefined;
    const result = await convertTransaction(
      async (url, options) => {
        seen = { url, method: options?.method, body: String(options?.body) };
        return {
          json: {
            data: [
              {
                transactionDocumentId: 'trx-1',
                workflowDocumentId: 'wf-1',
                createdDocumentIds: ['a', 'b'],
              },
            ],
          },
        };
      },
      'http://localhost:1337',
      { transactionDocumentId: 'trx-1', workflowDocumentId: 'wf-1' },
    );
    expect(seen?.url).toBe(
      'http://localhost:1337/api/transaction-workflows/convert',
    );
    expect(seen?.method).toBe('POST');
    expect(JSON.parse(seen?.body ?? '{}')).toEqual({
      transactionDocumentId: 'trx-1',
      workflowDocumentId: 'wf-1',
    });
    expect(result.createdDocumentIds).toEqual(['a', 'b']);
  });
});
