/**
 * convert-service.ts: keep_original write order (original mark, storno, steps),
 * incomplete-source storno publish gate, and partial-failure rollback.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CONVERTED_EXPANDED,
  CONVERTED_ORIGINAL,
  CONVERTED_STORNO,
  STEP_RELATED,
  TRANSACTION_UID,
  WORKFLOW_UID,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert.ts';
import { convertTransactions, type ConvertStrapi } from './convert-service.ts';

const huf = { documentId: 'cur-huf' };

function account(code: string, documentId = `acc-${code}`) {
  return { documentId, code };
}

const workflowTwoSteps: WorkflowTemplate = {
  documentId: 'wf-two',
  debit_account_code: 5440,
  credit_account_code: 2000,
  keep_original: true,
  steps_published: false,
  step: [
    {
      __component: STEP_RELATED,
      description: 'Step one',
      percent: 100,
      debit_account: account('5440'),
      credit_account: account('2000'),
      currency_type: huf,
    },
    {
      __component: STEP_RELATED,
      description: 'Step two',
      percent: 100,
      debit_account: account('2000'),
      credit_account: account('1100'),
      currency_type: huf,
    },
  ],
};

const expandableTransaction: SourceTransaction = {
  documentId: 'tx-source',
  date: '2026-11-03',
  amount: 111,
  description: 'source row',
  debit_account: account('5440'),
  credit_account: account('2000'),
  currency_type: huf,
};

const completeTransaction: SourceTransaction = {
  ...expandableTransaction,
  organization: { documentId: 'org-1' },
};

type RecordedOp =
  | {
      kind: 'update';
      documentId: string;
      converted: string | null | undefined;
    }
  | {
      kind: 'create';
      converted: string;
      enteredKey: string;
      hasReceiptsField: boolean;
    }
  | {
      kind: 'receiptConnect';
      transactionDocumentId: string;
      receiptIds: string[];
    }
  | { kind: 'delete'; documentId: string }
  | { kind: 'publish'; documentId: string };

type BuildOptions = {
  /** Fail after N successful creates (used to test rollback). */
  failAfterCreates?: number;
  /** Throw from publish for the given documentId. */
  failPublishDocumentId?: string;
};

function buildConvertStrapi(
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
  options: BuildOptions = {},
): { strapi: ConvertStrapi; ops: RecordedOp[] } {
  const ops: RecordedOp[] = [];
  let createCounter = 0;

  const transactionApi = {
    findOne: async () => transaction,
    findMany: async () => [],
    create: async ({ data }: { data: Record<string, unknown> }) => {
      createCounter += 1;
      if (
        options.failAfterCreates != null &&
        createCounter > options.failAfterCreates
      ) {
        throw new Error('forced create failure');
      }
      ops.push({
        kind: 'create',
        converted: String(data.converted_to_workflow),
        enteredKey: String(data.entered_key ?? ''),
        hasReceiptsField: 'receipts' in data,
      });
      return { documentId: `created-${createCounter}` };
    },
    update: async ({
      documentId,
      data,
    }: {
      documentId: string;
      data: Record<string, unknown>;
    }) => {
      const receipts = data.receipts as
        { connect?: { documentId: string }[] } | undefined;
      if (receipts?.connect?.length) {
        ops.push({
          kind: 'receiptConnect',
          transactionDocumentId: documentId,
          receiptIds: receipts.connect.map((row) => row.documentId),
        });
      }
      const converted = data.converted_to_workflow;
      ops.push({
        kind: 'update',
        documentId,
        converted:
          converted === null
            ? null
            : typeof converted === 'string'
              ? converted
              : undefined,
      });
      return {};
    },
    delete: async ({ documentId }: { documentId: string }) => {
      ops.push({ kind: 'delete', documentId });
      return {};
    },
    publish: async ({ documentId }: { documentId: string }) => {
      ops.push({ kind: 'publish', documentId });
      if (options.failPublishDocumentId === documentId) {
        throw new Error('forced publish failure');
      }
      return {};
    },
    unpublish: async () => ({}),
  };

  const workflowApi = {
    findOne: async () => workflow,
    findMany: async () => [workflow],
  };

  const byUid = new Map<string, typeof transactionApi | typeof workflowApi>([
    [TRANSACTION_UID, transactionApi],
    [WORKFLOW_UID, workflowApi],
  ]);

  const strapi: ConvertStrapi = {
    documents: (uid: string) => {
      const api = byUid.get(uid);
      if (!api) {
        throw new Error(`Unexpected documents uid in test: ${uid}`);
      }
      return api;
    },
    db: {
      query: () => ({
        // Complete stored draft → syncSourceAfterConvert may publish.
        findOne: async () =>
          transaction.organization
            ? {
                date: transaction.date,
                amount: transaction.amount,
                description: transaction.description,
                currency_type: transaction.currency_type,
                organization: transaction.organization,
                debit_account: transaction.debit_account,
                credit_account: transaction.credit_account,
              }
            : null,
      }),
    },
    requestContext: {
      get: () => ({ state: {} }),
    },
    log: { warn: () => {} },
  };

  return { strapi, ops };
}

function opSignature(op: RecordedOp): string {
  if (op.kind === 'update') {
    return `update:${op.documentId}:${op.converted ?? ''}`;
  }
  if (op.kind === 'delete') {
    return `delete:${op.documentId}`;
  }
  if (op.kind === 'publish') {
    return `publish:${op.documentId}`;
  }
  return `create:${op.converted}:${op.enteredKey}`;
}

describe('convertTransactions keep_original write order', () => {
  it('marks the source original before storno and expanded step creates', async () => {
    const { strapi, ops } = buildConvertStrapi(
      workflowTwoSteps,
      expandableTransaction,
    );

    await convertTransactions(strapi, {
      workflowDocumentId: workflowTwoSteps.documentId,
      transactionDocumentId: expandableTransaction.documentId,
    });

    assert.deepEqual(ops.map(opSignature), [
      `update:${expandableTransaction.documentId}:${CONVERTED_ORIGINAL}`,
      `create:${CONVERTED_STORNO}:${expandableTransaction.documentId}:storno`,
      `create:${CONVERTED_EXPANDED}:${expandableTransaction.documentId}:step:0`,
      `create:${CONVERTED_EXPANDED}:${expandableTransaction.documentId}:step:1`,
    ]);
  });

  it('does not mark the source original when keep_original is false', async () => {
    const workflow: WorkflowTemplate = {
      ...workflowTwoSteps,
      keep_original: false,
    };
    const { strapi, ops } = buildConvertStrapi(workflow, expandableTransaction);

    await convertTransactions(strapi, {
      workflowDocumentId: workflow.documentId,
      transactionDocumentId: expandableTransaction.documentId,
    });

    assert.equal(
      ops.some(
        (op) => op.kind === 'update' && op.converted === CONVERTED_ORIGINAL,
      ),
      false,
    );
    assert.deepEqual(ops.map(opSignature), [
      `create:${CONVERTED_EXPANDED}:${expandableTransaction.documentId}:step:0`,
      `create:${CONVERTED_EXPANDED}:${expandableTransaction.documentId}:step:1`,
      `delete:${expandableTransaction.documentId}`,
    ]);
  });

  it('keeps incomplete-source storno and steps as draft (related link needs a published source)', async () => {
    const workflow: WorkflowTemplate = {
      ...workflowTwoSteps,
      steps_published: true,
    };
    const { strapi, ops } = buildConvertStrapi(workflow, expandableTransaction);

    await convertTransactions(strapi, {
      workflowDocumentId: workflow.documentId,
      transactionDocumentId: expandableTransaction.documentId,
    });

    assert.deepEqual(
      ops.filter((op) => op.kind === 'publish'),
      [],
    );
  });

  it('publishes storno when the source already has the seven publish fields', async () => {
    const workflow: WorkflowTemplate = {
      ...workflowTwoSteps,
      steps_published: true,
    };
    const { strapi, ops } = buildConvertStrapi(workflow, completeTransaction);

    await convertTransactions(strapi, {
      workflowDocumentId: workflow.documentId,
      transactionDocumentId: completeTransaction.documentId,
    });

    assert.ok(
      ops.some(
        (op) =>
          op.kind === 'publish' &&
          op.documentId === completeTransaction.documentId,
      ),
    );
    assert.ok(
      ops.some((op) => op.kind === 'publish' && op.documentId === 'created-1'),
    );
  });

  it('rolls back storno and clears original mark when a later step create fails', async () => {
    const { strapi, ops } = buildConvertStrapi(
      workflowTwoSteps,
      expandableTransaction,
      { failAfterCreates: 1 },
    );

    await assert.rejects(
      () =>
        convertTransactions(strapi, {
          workflowDocumentId: workflowTwoSteps.documentId,
          transactionDocumentId: expandableTransaction.documentId,
        }),
      /forced create failure/,
    );

    assert.deepEqual(ops.map(opSignature), [
      `update:${expandableTransaction.documentId}:${CONVERTED_ORIGINAL}`,
      `create:${CONVERTED_STORNO}:${expandableTransaction.documentId}:storno`,
      'delete:created-1',
      `update:${expandableTransaction.documentId}:`,
    ]);
    const clear = ops.find(
      (op) =>
        op.kind === 'update' &&
        op.documentId === expandableTransaction.documentId &&
        op.converted === null,
    );
    assert.ok(clear);
  });
});

describe('convertTransactions copy_receipt', () => {
  it('connects receipts after step create without receipts on create payload', async () => {
    const workflow: WorkflowTemplate = {
      ...workflowTwoSteps,
      step: [
        { ...workflowTwoSteps.step[0]!, copy_receipt: true },
        workflowTwoSteps.step[1]!,
      ],
    };
    const transaction: SourceTransaction = {
      ...expandableTransaction,
      receipts: [{ documentId: 'rcpt-shared' }],
    };
    const { strapi, ops } = buildConvertStrapi(workflow, transaction);

    await convertTransactions(strapi, {
      workflowDocumentId: workflow.documentId,
      transactionDocumentId: transaction.documentId,
    });

    const creates = ops.filter((op) => op.kind === 'create');
    assert.ok(
      creates.every((op) => op.kind === 'create' && !op.hasReceiptsField),
      'receipts must not be embedded on create (would move links)',
    );
    const connects = ops.filter((op) => op.kind === 'receiptConnect');
    assert.deepEqual(connects, [
      {
        kind: 'receiptConnect',
        transactionDocumentId: 'created-2',
        receiptIds: ['rcpt-shared'],
      },
    ]);
  });
});
