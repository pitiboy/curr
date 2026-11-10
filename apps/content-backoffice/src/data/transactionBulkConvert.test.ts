import { describe, expect, it, vi } from 'vitest';

import {
  isExpandableConvertedValue,
  type TransactionRow,
  type WorkflowTemplateHeader,
} from './transactionList';
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

const costTemplate: WorkflowTemplateHeader = {
  documentId: 'wf-cost',
  name: 'Költség',
  debit_account_code: 5200,
  credit_account_code: 1101,
  requires_source_organization: false,
};

const baseDraft: TransactionRow = {
  id: 'doc-1',
  documentId: 'doc-1',
  status: 'draft',
  date: '2026-01-01',
  amount: 100,
  description: 'ok',
  debit_account: { code: '1520' },
  credit_account: { code: '1101' },
};

function readyJobs(classification: ReturnType<typeof classifyBulkConvertRows>) {
  return classification.ready.map((item) => ({
    transactionDocumentId: item.record.documentId,
    workflowDocumentId: item.workflow.documentId,
  }));
}

describe('isExpandableConvertedValue (bulk convert selection)', () => {
  it.each([null, '', false] as const)(
    'treats %s as expandable for matching',
    (value) => {
      expect(isExpandableConvertedValue(value)).toBe(true);
    },
  );

  it.each(['original', 'expanded', 'storno'] as const)(
    'rejects %s as not expandable',
    (value) => {
      expect(isExpandableConvertedValue(value)).toBe(false);
    },
  );
});

describe('classifyBulkConvertRows', () => {
  it('accepts expandable rows with exactly one matching workflow', () => {
    const result = classifyBulkConvertRows([baseDraft], [ugyelet1Template]);
    expect(result.ready).toHaveLength(1);
    expect(result.ready[0]?.workflow.documentId).toBe('wf-1');
    expect(result.skipped).toHaveLength(0);
  });

  it('classifies mixed selection: only ready rows are convertible', () => {
    const readyOther = {
      ...baseDraft,
      id: 'doc-ready-2',
      documentId: 'doc-ready-2',
      debit_account: { code: '5200' },
    };
    const converted = {
      ...baseDraft,
      id: 'doc-converted',
      documentId: 'doc-converted',
      converted_to_workflow: 'expanded' as const,
    };
    const noMatch = {
      ...baseDraft,
      id: 'doc-nomatch',
      documentId: 'doc-nomatch',
      debit_account: { code: '9999' },
    };
    const result = classifyBulkConvertRows(
      [baseDraft, readyOther, converted, noMatch],
      [ugyelet1Template, costTemplate],
    );
    expect(result.ready.map((row) => row.record.documentId).sort()).toEqual([
      'doc-1',
      'doc-ready-2',
    ]);
    expect(result.ready[0]?.workflow.documentId).toBe('wf-1');
    expect(result.ready[1]?.workflow.documentId).toBe('wf-cost');
    expect(
      result.skipped.map(({ record, reason }) => [record.documentId, reason]),
    ).toEqual([
      ['doc-converted', 'already_converted'],
      ['doc-nomatch', 'no_match'],
    ]);
  });

  it('skips already converted / not expandable rows', () => {
    const converted = {
      ...baseDraft,
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
      ...baseDraft,
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
      [baseDraft],
      [ugyelet1Template, twin],
    );
    expect(result.ready).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('ambiguous');
  });

  it('assigns each ready row its own matching workflow documentId', () => {
    const rowA = { ...baseDraft };
    const rowB = {
      ...baseDraft,
      id: 'doc-b',
      documentId: 'doc-b',
      debit_account: { code: '5200' },
    };
    const result = classifyBulkConvertRows(
      [rowA, rowB],
      [ugyelet1Template, costTemplate],
    );
    expect(
      result.ready.map((item) => ({
        transaction: item.record.documentId,
        workflow: item.workflow.documentId,
      })),
    ).toEqual([
      { transaction: 'doc-1', workflow: 'wf-1' },
      { transaction: 'doc-b', workflow: 'wf-cost' },
    ]);
  });

  it('returns empty ready for an empty selection', () => {
    const result = classifyBulkConvertRows([], [ugyelet1Template]);
    expect(result.ready).toEqual([]);
    expect(result.skipped).toEqual([]);
  });
});

describe('bulkConvertTransactions', () => {
  it('converts an empty job list without calling convert', async () => {
    const convert = vi.fn();
    const outcome = await bulkConvertTransactions([], convert);
    expect(convert).not.toHaveBeenCalled();
    expect(outcome).toEqual({ succeeded: [], failed: [] });
  });

  it('passes both transactionDocumentId and workflowDocumentId on every call', async () => {
    const convert = vi.fn().mockResolvedValue(undefined);
    await bulkConvertTransactions(
      [
        { transactionDocumentId: 'tx-a', workflowDocumentId: 'wf-1' },
        { transactionDocumentId: 'tx-b', workflowDocumentId: 'wf-2' },
      ],
      convert,
    );
    expect(convert.mock.calls).toEqual([
      ['tx-a', 'wf-1'],
      ['tx-b', 'wf-2'],
    ]);
  });

  it('succeeds for every item when all converts pass', async () => {
    const convert = vi.fn().mockResolvedValue(undefined);
    const outcome = await bulkConvertTransactions(
      [
        { transactionDocumentId: 'a', workflowDocumentId: 'wf-1' },
        { transactionDocumentId: 'b', workflowDocumentId: 'wf-1' },
      ],
      convert,
    );
    expect(outcome.succeeded).toEqual(['a', 'b']);
    expect(outcome.failed).toEqual([]);
  });

  it('fails every item when all converts reject', async () => {
    const convert = vi.fn().mockRejectedValue(new Error('nope'));
    const outcome = await bulkConvertTransactions(
      [
        { transactionDocumentId: 'a', workflowDocumentId: 'wf-1' },
        { transactionDocumentId: 'b', workflowDocumentId: 'wf-1' },
      ],
      convert,
    );
    expect(outcome.succeeded).toEqual([]);
    expect(outcome.failed.map((row) => row.transactionDocumentId)).toEqual([
      'a',
      'b',
    ]);
  });

  it('continues after a per-item failure and keeps earlier successes', async () => {
    const convert = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('convert failed'))
      .mockResolvedValueOnce(undefined);

    const outcome = await bulkConvertTransactions(
      [
        { transactionDocumentId: 'a', workflowDocumentId: 'wf-1' },
        { transactionDocumentId: 'b', workflowDocumentId: 'wf-1' },
        { transactionDocumentId: 'c', workflowDocumentId: 'wf-1' },
      ],
      convert,
    );

    expect(convert).toHaveBeenCalledTimes(3);
    expect(convert.mock.calls).toEqual([
      ['a', 'wf-1'],
      ['b', 'wf-1'],
      ['c', 'wf-1'],
    ]);
    expect(outcome.succeeded).toEqual(['a', 'c']);
    expect(outcome.failed[0]).toMatchObject({
      transactionDocumentId: 'b',
      message: 'convert failed',
    });
    expect(outcome.failed[0]?.transactionDocumentId).not.toBe('a');
    expect(outcome.succeeded).not.toContain('b');
  });

  it('never re-calls a transaction that already succeeded when a later item fails', async () => {
    const callsPerTx = new Map<string, number>();
    const convert = vi.fn(async (transactionDocumentId: string) => {
      callsPerTx.set(
        transactionDocumentId,
        (callsPerTx.get(transactionDocumentId) ?? 0) + 1,
      );
      if (transactionDocumentId === 'b') {
        throw new Error('fail b');
      }
    });

    await bulkConvertTransactions(
      [
        { transactionDocumentId: 'a', workflowDocumentId: 'wf-1' },
        { transactionDocumentId: 'b', workflowDocumentId: 'wf-1' },
        { transactionDocumentId: 'c', workflowDocumentId: 'wf-1' },
      ],
      convert,
    );

    expect(callsPerTx.get('a')).toBe(1);
    expect(callsPerTx.get('b')).toBe(1);
    expect(callsPerTx.get('c')).toBe(1);
  });

  it('mixed selection pipeline sends only classified ready rows to convert', async () => {
    const converted = {
      ...baseDraft,
      id: 'skip-me',
      documentId: 'skip-me',
      converted_to_workflow: 'storno' as const,
    };
    const classification = classifyBulkConvertRows(
      [baseDraft, converted],
      [ugyelet1Template],
    );
    const convert = vi.fn().mockResolvedValue(undefined);
    await bulkConvertTransactions(readyJobs(classification), convert);

    expect(convert).toHaveBeenCalledTimes(1);
    expect(convert).toHaveBeenCalledWith('doc-1', 'wf-1');
    expect(convert).not.toHaveBeenCalledWith('skip-me', expect.anything());
  });

  it('does not start the next convert before the previous await settles', async () => {
    const order: string[] = [];
    let inFlight = 0;
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const convert = vi.fn(
      async (transactionDocumentId: string, _workflowDocumentId: string) => {
        inFlight += 1;
        expect(inFlight).toBe(1);
        order.push(`start:${transactionDocumentId}`);
        if (transactionDocumentId === 'a') {
          await firstGate;
        }
        order.push(`end:${transactionDocumentId}`);
        inFlight -= 1;
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
