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
  ERROR_TRANSACTION_ALREADY_CONVERTED,
  STEP_RELATED,
  TRANSACTION_UID,
  WORKFLOW_UID,
  isExpandableConvertedValue,
  type SourceTransaction,
  type WorkflowTemplate,
} from './convert.ts';
import {
  convertTransactions,
  parseOverridesPayload,
  type ConvertStrapi,
} from './convert-service.ts';

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
  /** Source row reflects writes (mark original / delete) and creates yield. */
  stateful?: boolean;
};

function buildConvertStrapi(
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
  options: BuildOptions = {},
): { strapi: ConvertStrapi; ops: RecordedOp[] } {
  const ops: RecordedOp[] = [];
  let createCounter = 0;
  let source: SourceTransaction | null = { ...transaction };
  const yieldTick = () => new Promise((resolve) => setImmediate(resolve));

  const draftPublishRow = () => {
    const row = options.stateful && source ? source : transaction;
    const organization = row.organization ?? null;
    if (!organization) return null;
    return {
      date: row.date,
      amount: row.amount,
      description: row.description,
      currency_type: row.currency_type,
      organization,
      debit_account: row.debit_account,
      credit_account: row.credit_account,
    };
  };

  const transactionApi = {
    findOne: async () => (options.stateful ? source : transaction),
    findMany: async () => [],
    create: async ({ data }: { data: Record<string, unknown> }) => {
      // Simulate the DB round-trip so concurrent converts interleave.
      if (options.stateful) await yieldTick();
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
      if (source && documentId === source.documentId) {
        const next: SourceTransaction = { ...source };
        if ('converted_to_workflow' in data) {
          next.converted_to_workflow =
            converted as SourceTransaction['converted_to_workflow'];
        }
        if (typeof data.organization === 'string' && data.organization) {
          next.organization = { documentId: data.organization };
        }
        source = next;
        // Non-stateful mocks still need the org fill to show up on publish checks.
        if (!options.stateful && next.organization) {
          transaction.organization = next.organization;
        }
      }
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
      if (options.stateful && source?.documentId === documentId) source = null;
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
        findOne: async ({
          select,
        }: {
          select?: string[];
        } = {}) => {
          if (select?.includes('converted_to_workflow')) {
            return options.stateful && source
              ? { converted_to_workflow: source.converted_to_workflow }
              : { converted_to_workflow: transaction.converted_to_workflow };
          }
          return draftPublishRow();
        },
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          if (options.stateful) {
            if (!source) return { count: 0 };
            if (
              'converted_to_workflow' in data &&
              isExpandableConvertedValue(source.converted_to_workflow)
            ) {
              source = {
                ...source,
                converted_to_workflow:
                  data.converted_to_workflow as SourceTransaction['converted_to_workflow'],
              };
              return { count: 1 };
            }
            return { count: 0 };
          }
          return { count: 1 };
        },
      }),
      transaction: async <T>(task: () => Promise<T>) => task(),
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

    const { results } = await convertTransactions(strapi, {
      workflowDocumentId: workflowTwoSteps.documentId,
      transactionDocumentId: expandableTransaction.documentId,
    });
    assert.equal(results.length, 1);

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

    const { results } = await convertTransactions(strapi, {
      workflowDocumentId: workflow.documentId,
      transactionDocumentId: expandableTransaction.documentId,
    });
    assert.equal(results.length, 1);

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

  it('honours overrides.keepOriginal over the workflow template flag', async () => {
    const workflow: WorkflowTemplate = {
      ...workflowTwoSteps,
      keep_original: true,
    };
    const { strapi, ops } = buildConvertStrapi(workflow, expandableTransaction);

    const { results } = await convertTransactions(strapi, {
      workflowDocumentId: workflow.documentId,
      transactionDocumentId: expandableTransaction.documentId,
      overrides: { keepOriginal: false },
    });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.customised, true);
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

  it('honours overrides.stepsPublished over the workflow template flag', async () => {
    const workflow: WorkflowTemplate = {
      ...workflowTwoSteps,
      steps_published: false,
    };
    const { strapi, ops } = buildConvertStrapi(workflow, completeTransaction);

    await convertTransactions(strapi, {
      workflowDocumentId: workflow.documentId,
      transactionDocumentId: completeTransaction.documentId,
      overrides: { stepsPublished: true },
    });

    assert.ok(ops.some((op) => op.kind === 'publish'));
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

  it('copies step organization onto an incomplete source so steps_published can publish', async () => {
    const workflow: WorkflowTemplate = {
      ...workflowTwoSteps,
      steps_published: true,
      step: [
        {
          ...workflowTwoSteps.step[0]!,
          organization: { documentId: 'org-from-step' },
        },
        {
          ...workflowTwoSteps.step[1]!,
          organization: { documentId: 'org-from-step' },
        },
      ],
    };
    const source: SourceTransaction = { ...expandableTransaction };
    const { strapi, ops } = buildConvertStrapi(workflow, source);

    await convertTransactions(strapi, {
      workflowDocumentId: workflow.documentId,
      transactionDocumentId: source.documentId,
    });

    assert.equal(source.organization?.documentId, 'org-from-step');
    assert.ok(
      ops.some(
        (op) => op.kind === 'publish' && op.documentId === source.documentId,
      ),
    );
    assert.ok(
      ops.some((op) => op.kind === 'publish' && op.documentId === 'created-1'),
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

describe('convertTransactions concurrent requests (double submit)', () => {
  for (const keepOriginal of [true, false]) {
    it(`expands the source once when two converts race (keep_original=${keepOriginal})`, async () => {
      const workflow: WorkflowTemplate = {
        ...workflowTwoSteps,
        keep_original: keepOriginal,
      };
      const { strapi, ops } = buildConvertStrapi(
        workflow,
        expandableTransaction,
        { stateful: true },
      );
      const request = {
        workflowDocumentId: workflow.documentId,
        transactionDocumentId: expandableTransaction.documentId,
      };

      const [first, second] = await Promise.allSettled([
        convertTransactions(strapi, request),
        convertTransactions(strapi, request),
      ]);

      assert.equal(first.status, 'fulfilled');
      assert.equal(second.status, 'rejected');
      if (first.status === 'fulfilled') {
        assert.equal(first.value.results.length, 1);
      }
      if (second.status === 'rejected') {
        const reason = second.reason as { message?: string; code?: string };
        assert.match(reason.message ?? '', /ki van fejtve/);
        assert.equal(reason.code, ERROR_TRANSACTION_ALREADY_CONVERTED);
      }
      const stepCreates = ops.filter(
        (op) => op.kind === 'create' && op.converted === CONVERTED_EXPANDED,
      );
      assert.equal(stepCreates.length, 2);
    });
  }
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

  it('connects receipts on draft before publishing the step', async () => {
    const workflow: WorkflowTemplate = {
      ...workflowTwoSteps,
      steps_published: true,
      step: [
        { ...workflowTwoSteps.step[0]!, copy_receipt: true },
        workflowTwoSteps.step[1]!,
      ],
    };
    const transaction: SourceTransaction = {
      ...completeTransaction,
      receipts: [{ documentId: 'rcpt-shared' }],
    };
    const { strapi, ops } = buildConvertStrapi(workflow, transaction);

    await convertTransactions(strapi, {
      workflowDocumentId: workflow.documentId,
      transactionDocumentId: transaction.documentId,
    });

    // keep_original: created-1 storno, created-2 first step (copy_receipt).
    const createIdx = ops.findIndex(
      (op) =>
        op.kind === 'create' &&
        op.converted === CONVERTED_EXPANDED &&
        op.enteredKey.endsWith(':step:0'),
    );
    const connectIdx = ops.findIndex(
      (op) =>
        op.kind === 'receiptConnect' &&
        op.transactionDocumentId === 'created-2',
    );
    const publishIdx = ops.findIndex(
      (op) => op.kind === 'publish' && op.documentId === 'created-2',
    );
    assert.ok(createIdx >= 0);
    assert.ok(connectIdx >= 0);
    assert.ok(publishIdx >= 0);
    assert.ok(
      createIdx < connectIdx && connectIdx < publishIdx,
      'published copy_receipt steps must link receipts before publish',
    );
  });
});

describe('parseOverridesPayload', () => {
  it('accepts flag-only overrides without legs', () => {
    assert.deepEqual(parseOverridesPayload({ keepOriginal: false }), {
      keepOriginal: false,
    });
    assert.deepEqual(parseOverridesPayload({ stepsPublished: true }), {
      stepsPublished: true,
    });
  });

  it('returns undefined for empty objects', () => {
    assert.equal(parseOverridesPayload({}), undefined);
    assert.equal(parseOverridesPayload({ legs: [] }), undefined);
  });

  it('parses legs together with flags', () => {
    const parsed = parseOverridesPayload({
      keepOriginal: true,
      legs: [
        {
          key: 'step:0',
          sourceStepIndex: 0,
          description: 'x',
          amount: 10,
          percent: 100,
          debitAccountDocumentId: 'd',
          creditAccountDocumentId: 'c',
          currencyTypeDocumentId: 'cur',
          copyReceipt: false,
        },
      ],
    });
    assert.equal(parsed?.keepOriginal, true);
    assert.equal(parsed?.legs?.length, 1);
  });
});
