/**
 * convert-service.ts: keep_original write order (original mark, storno, steps).
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

type RecordedOp =
  | { kind: 'update'; documentId: string; converted: string | undefined }
  | { kind: 'create'; converted: string; enteredKey: string }
  | { kind: 'delete'; documentId: string };

function buildConvertStrapi(
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
): { strapi: ConvertStrapi; ops: RecordedOp[] } {
  const ops: RecordedOp[] = [];
  let createCounter = 0;

  const transactionApi = {
    findOne: async () => transaction,
    findMany: async () => [],
    create: async ({ data }: { data: Record<string, unknown> }) => {
      createCounter += 1;
      ops.push({
        kind: 'create',
        converted: String(data.converted_to_workflow),
        enteredKey: String(data.entered_key ?? ''),
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
      ops.push({
        kind: 'update',
        documentId,
        converted:
          typeof data.converted_to_workflow === 'string'
            ? data.converted_to_workflow
            : undefined,
      });
      return {};
    },
    delete: async ({ documentId }: { documentId: string }) => {
      ops.push({ kind: 'delete', documentId });
      return {};
    },
    publish: async () => ({}),
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
        findOne: async () => null,
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
});
