import { describe, expect, it, vi } from 'vitest';

import type { TransactionRow, WorkflowTemplateHeader } from './transactionList';
import {
  bulkConvertTransactions,
  classifyBulkConvertRows,
} from './transactionBulkConvert';

const ugyelet1Template: WorkflowTemplateHeader = {
  documentId: 'wf-1',
  name: 'Ügylet 1',
  debit_account_code: 1520,
  credit_account_code: 1101,
  requires_source_organization: false,
};

const convertibleDraft: TransactionRow = {
  id: 'doc-1',
  documentId: 'doc-1',
  status: 'draft',
  date: '2026-01-01',
  amount: 100,
  description: 'ok',
  debit_account: { code: '1520' },
  credit_account: { code: '1101' },
};

describe('classifyBulkConvertRows', () => {
  it('accepts expandable rows with exactly one matching workflow', () => {
    const result = classifyBulkConvertRows(
      [convertibleDraft],
      [ugyelet1Template],
    );
    expect(result.ready).toHaveLength(1);
    expect(result.ready[0]?.workflow.documentId).toBe('wf-1');
    expect(result.skipped).toHaveLength(0);
  });

  it('skips already converted rows', () => {
    const converted = {
      ...convertibleDraft,
      id: 'doc-2',
      documentId: 'doc-2',
      converted_to_workflow: 'original' as const,
    };
    const result = classifyBulkConvertRows([converted], [ugyelet1Template]);
    expect(result.ready).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('already_converted');
  });

  it('skips when no workflow matches', () => {
    const mismatch = {
      ...convertibleDraft,
      debit_account: { code: '9999' },
    };
    const result = classifyBulkConvertRows([mismatch], [ugyelet1Template]);
    expect(result.ready).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('no_match');
  });

  it('skips when more than one workflow matches', () => {
    const twin: WorkflowTemplateHeader = {
      ...ugyelet1Template,
      documentId: 'wf-2',
    };
    const result = classifyBulkConvertRows(
      [convertibleDraft],
      [ugyelet1Template, twin],
    );
    expect(result.ready).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('ambiguous');
  });
});

describe('bulkConvertTransactions', () => {
  it('converts sequentially and collects failures', async () => {
    const convert = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('convert failed'));

    const outcome = await bulkConvertTransactions(
      [
        { transactionDocumentId: 'a', workflowDocumentId: 'wf-1' },
        { transactionDocumentId: 'b', workflowDocumentId: 'wf-1' },
      ],
      convert,
    );

    expect(convert).toHaveBeenCalledTimes(2);
    expect(convert.mock.calls).toEqual([
      ['a', 'wf-1'],
      ['b', 'wf-1'],
    ]);
    expect(outcome.succeeded).toEqual(['a']);
    expect(outcome.failed).toEqual([
      {
        transactionDocumentId: 'b',
        workflowDocumentId: 'wf-1',
        message: 'convert failed',
      },
    ]);
  });

  it('does not start the next convert before the previous await settles', async () => {
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const convert = vi.fn(
      async (transactionDocumentId: string, _workflowDocumentId: string) => {
        order.push(`start:${transactionDocumentId}`);
        if (transactionDocumentId === 'a') {
          await firstGate;
        }
        order.push(`end:${transactionDocumentId}`);
      },
    );

    const run = bulkConvertTransactions(
      [
        { transactionDocumentId: 'a', workflowDocumentId: 'wf-1' },
        { transactionDocumentId: 'b', workflowDocumentId: 'wf-1' },
      ],
      convert,
    );

    await Promise.resolve();
    expect(order).toEqual(['start:a']);
    expect(convert).toHaveBeenCalledTimes(1);

    releaseFirst?.();
    const outcome = await run;

    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
    expect(outcome.succeeded).toEqual(['a', 'b']);
  });
});
