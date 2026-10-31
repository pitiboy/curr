import { describe, expect, it, vi } from 'vitest';

import type { ContentHttpClient } from './receiptDraft';
import type { WorkflowTemplate } from './transactionList';
import {
  convertTransaction,
  fetchPublishedWorkflows,
  transactionWorkflowConvertUrl,
  workflowSubjectFromForm,
} from './transactionWorkflow';
import {
  createWorkflowCatalogLoader,
  loadCatalogForRole,
  NO_WORKFLOWS,
} from './transactionWorkflowCatalog';

const template = (documentId: string): WorkflowTemplate => ({
  documentId,
  name: documentId,
  debit_account_code: 1520,
  credit_account_code: 1101,
});

describe('fetchPublishedWorkflows', () => {
  it('asks for published templates with currency and type, no steps', async () => {
    const urls: string[] = [];
    const client: ContentHttpClient = async (url) => {
      urls.push(url);
      return {
        json: { data: [template('a')], meta: { pagination: { pageCount: 1 } } },
      };
    };
    const rows = await fetchPublishedWorkflows(client, 'http://localhost:1337');
    expect(rows).toEqual([template('a')]);
    const [base, query] = urls[0].split('?');
    expect(base).toBe('http://localhost:1337/api/transaction-workflows');
    const params = new URLSearchParams(query);
    expect(params.get('status')).toBe('published');
    expect(params.get('populate[currency_type][fields][0]')).toBe('documentId');
    expect(params.get('populate[transaction_type][fields][0]')).toBe(
      'documentId',
    );
    expect(query).not.toContain('step');
  });

  it('pages until the last page', async () => {
    const pages: string[] = [];
    const client: ContentHttpClient = async (url) => {
      const page = new URLSearchParams(url.split('?')[1]).get(
        'pagination[page]',
      );
      pages.push(String(page));
      return {
        json: {
          data: [template(`p${page}`)],
          meta: { pagination: { pageCount: 2 } },
        },
      };
    };
    const rows = await fetchPublishedWorkflows(client, 'http://x');
    expect(pages).toEqual(['1', '2']);
    expect(rows.map((row) => row.documentId)).toEqual(['p1', 'p2']);
  });
});

describe('convertTransaction', () => {
  it('posts the two document ids and nothing else', async () => {
    let seen: { url: string; method?: string; body?: string } | undefined;
    const client: ContentHttpClient = async (url, options) => {
      seen = { url, method: options?.method, body: String(options?.body) };
      return {
        json: {
          data: [
            {
              transactionDocumentId: 'trx-1',
              workflowDocumentId: 'wf-1',
              createdDocumentIds: ['n1', 'n2'],
            },
          ],
        },
      };
    };
    const result = await convertTransaction(client, 'http://localhost:1337', {
      transactionDocumentId: 'trx-1',
      workflowDocumentId: 'wf-1',
    });
    expect(seen?.url).toBe(
      transactionWorkflowConvertUrl('http://localhost:1337'),
    );
    expect(seen?.url).toBe(
      'http://localhost:1337/api/transaction-workflows/convert',
    );
    expect(seen?.method).toBe('POST');
    expect(JSON.parse(seen?.body ?? '{}')).toEqual({
      transactionDocumentId: 'trx-1',
      workflowDocumentId: 'wf-1',
    });
    expect(seen?.body).not.toContain('steps_published');
    expect(result[0].createdDocumentIds).toEqual(['n1', 'n2']);
  });

  it('propagates a server error', async () => {
    const client: ContentHttpClient = async () => {
      throw Object.assign(new Error('Conflict'), { status: 409 });
    };
    await expect(
      convertTransaction(client, 'http://x', {
        transactionDocumentId: 't',
        workflowDocumentId: 'w',
      }),
    ).rejects.toThrow('Conflict');
  });
});

describe('workflowSubjectFromForm', () => {
  const accounts = [
    { id: 'acc-1520', code: '1520', name: 'Belterületi földterületek' },
    { id: 'acc-1101', code: '1101', name: 'Tagi számla' },
  ];

  it('resolves account documentIds to codes through the catalog', () => {
    expect(
      workflowSubjectFromForm(
        {
          debit_account: 'acc-1520',
          credit_account: 'acc-1101',
          currency_type: 'huf',
        },
        accounts,
      ),
    ).toEqual({
      debit_account: { code: '1520' },
      credit_account: { code: '1101' },
      currency_type: { documentId: 'huf' },
      transaction_type: null,
    });
  });

  it('leaves unknown or empty selections without a code', () => {
    const subject = workflowSubjectFromForm(
      { debit_account: 'gone', credit_account: '', currency_type: undefined },
      accounts,
    );
    expect(subject.debit_account?.code).toBeNull();
    expect(subject.credit_account?.code).toBeNull();
    expect(subject.currency_type).toBeNull();
  });
});

describe('workflow catalog loader', () => {
  it('does not fetch for dataentry or an unknown role', async () => {
    const fetchAll = vi.fn(async () => [template('a')]);
    const loader = createWorkflowCatalogLoader(fetchAll);
    expect(await loadCatalogForRole('dataentry', loader)).toBe(NO_WORKFLOWS);
    expect(await loadCatalogForRole(undefined, loader)).toBe(NO_WORKFLOWS);
    expect(fetchAll).not.toHaveBeenCalled();
  });

  it('fetches once for editor however often it is asked', async () => {
    const fetchAll = vi.fn(async () => [template('a')]);
    const loader = createWorkflowCatalogLoader(fetchAll);
    const first = await loadCatalogForRole('editor', loader);
    const second = await loadCatalogForRole('editor', loader);
    expect(first).toEqual([template('a')]);
    expect(second).toBe(first);
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight request and retries after a failure', async () => {
    const fetchAll = vi
      .fn<() => Promise<WorkflowTemplate[]>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue([template('b')]);
    const loader = createWorkflowCatalogLoader(fetchAll);
    await expect(loader.load()).rejects.toThrow('down');
    const [one, two] = await Promise.all([loader.load(), loader.load()]);
    expect(one).toBe(two);
    expect(fetchAll).toHaveBeenCalledTimes(2);
  });
});
