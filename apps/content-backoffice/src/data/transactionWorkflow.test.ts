import { describe, expect, it } from 'vitest';

import {
  convertTransaction,
  fetchPublishedWorkflows,
  transactionWorkflowConvertUrl,
  workflowRequiresSourceOrganization,
} from './transactionWorkflow';

describe('workflowRequiresSourceOrganization', () => {
  it('is true when any step copies organization from the source', () => {
    expect(workflowRequiresSourceOrganization(undefined)).toBe(false);
    expect(
      workflowRequiresSourceOrganization([
        { organization_from_original: false },
        { organization_from_original: true },
      ]),
    ).toBe(true);
  });
});

describe('transactionWorkflowConvertUrl', () => {
  it('targets the custom convert route', () => {
    expect(transactionWorkflowConvertUrl('http://localhost:1337')).toBe(
      'http://localhost:1337/api/transaction-workflows/convert',
    );
  });
});

describe('fetchPublishedWorkflows', () => {
  it('requests published templates with currency, type, and step org flags', async () => {
    const seen: string[] = [];
    const rows = await fetchPublishedWorkflows(async (url) => {
      seen.push(url);
      return {
        json: {
          data: [
            {
              documentId: 'wf-1',
              name: 'Ügylet 1',
              debit_account_code: 1520,
              credit_account_code: 1101,
              currency_type: {
                documentId: 'cur-kor',
                code: 'KOR',
                name: 'Korona',
              },
              transaction_type: {
                documentId: 'type-banyaszas',
                name: 'Bányászás',
              },
              step: [
                {
                  __component: 'workflow.step',
                  organization_from_original: true,
                },
              ],
            },
            {
              documentId: 'wf-2',
              name: 'Fix org',
              debit_account_code: 1000,
              credit_account_code: 1900,
              step: [
                {
                  __component: 'workflow.step',
                  organization_from_original: false,
                },
              ],
            },
          ],
          meta: { pagination: { pageCount: 1 } },
        },
      };
    }, 'http://localhost:1337');
    expect(seen).toHaveLength(1);
    const params = new URL(seen[0]!).searchParams;
    expect(params.get('status')).toBe('published');
    expect(params.get('populate[currency_type][fields][0]')).toBe('documentId');
    expect(params.get('populate[currency_type][fields][1]')).toBe('code');
    expect(params.get('populate[currency_type][fields][2]')).toBe('name');
    expect(params.get('populate[transaction_type][fields][0]')).toBe(
      'documentId',
    );
    expect(params.get('populate[transaction_type][fields][1]')).toBe('name');
    expect(
      params.get('populate[step][on][workflow.step][fields][0]'),
    ).toBe('organization_from_original');
    expect(
      params.get(
        'populate[step][on][workflow.step-member-debit][fields][0]',
      ),
    ).toBe('organization_from_original');
    expect(
      params.get(
        'populate[step][on][workflow.step-member-credit][fields][0]',
      ),
    ).toBe('organization_from_original');
    expect(rows).toEqual([
      {
        documentId: 'wf-1',
        name: 'Ügylet 1',
        debit_account_code: 1520,
        credit_account_code: 1101,
        currency_type: {
          documentId: 'cur-kor',
          code: 'KOR',
          name: 'Korona',
        },
        transaction_type: {
          documentId: 'type-banyaszas',
          name: 'Bányászás',
        },
        requires_source_organization: true,
      },
      {
        documentId: 'wf-2',
        name: 'Fix org',
        debit_account_code: 1000,
        credit_account_code: 1900,
        currency_type: null,
        transaction_type: null,
        requires_source_organization: false,
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
