import { describe, expect, it, vi } from 'vitest';

import type { TransactionRow } from './transactionList';
import {
  bulkPublishTransactions,
  classifyBulkApproveRows,
} from './transactionBulkApprove';

const completeDraft: TransactionRow = {
  id: 'doc-1',
  documentId: 'doc-1',
  status: 'draft',
  date: '2026-01-01',
  amount: 100,
  description: 'ok',
  entered_by: 'dataentry@example.com',
  currency_type: { documentId: 'cur-1' },
  organization: { documentId: 'org-1' },
  debit_account: { documentId: 'debit-1' },
  credit_account: { documentId: 'credit-1' },
};

describe('classifyBulkApproveRows', () => {
  it('accepts a complete draft entered by someone else', () => {
    const result = classifyBulkApproveRows([completeDraft], 'editor@example.com');
    expect(result.ready).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it('skips published rows and incomplete drafts', () => {
    const incomplete = {
      ...completeDraft,
      id: 'doc-2',
      documentId: 'doc-2',
      organization: null,
    };
    const published = {
      ...completeDraft,
      id: 'doc-3',
      documentId: 'doc-3',
      status: 'published' as const,
    };
    const result = classifyBulkApproveRows(
      [completeDraft, incomplete, published],
      'editor@example.com',
    );
    expect(result.ready.map((row) => row.documentId)).toEqual(['doc-1']);
    expect(result.skipped.map(({ reason }) => reason)).toEqual([
      'incomplete',
      'not_draft',
    ]);
  });

  it('skips drafts the editor entered', () => {
    const own = {
      ...completeDraft,
      entered_by: 'Editor@Example.com',
    };
    const result = classifyBulkApproveRows([own], 'editor@example.com');
    expect(result.ready).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('same_person');
  });
});

describe('bulkPublishTransactions', () => {
  it('publishes sequentially and collects failures', async () => {
    const publish = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({
        body: {
          error: {
            message: 'The person who entered the document cannot publish it',
          },
        },
      });

    const outcome = await bulkPublishTransactions(['a', 'b'], publish);

    expect(publish).toHaveBeenCalledTimes(2);
    expect(outcome.succeeded).toEqual(['a']);
    expect(outcome.failed).toEqual([
      {
        documentId: 'b',
        message: 'The person who entered the document cannot publish it',
        samePerson: true,
      },
    ]);
  });
});
