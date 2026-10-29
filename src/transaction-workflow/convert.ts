/**
 * Convert üzleti logika (Strapi nélkül, tesztelhető).
 * Match: published sablon fejléc kódok + opcionális pénznem/típus, converted_to_workflow === false.
 * Expand: step percent → összeg, {1} leírás, 1101/1001 a forrás trx / testvér számlából.
 * Hibák: TransactionWorkflowError HTTP státusszal (409 ütköző sablon, 422 hiányzó adat).
 */
export class TransactionWorkflowError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TransactionWorkflowError';
    this.status = status;
  }
}

export const TRANSACTION_UID = 'api::transaction.transaction';
export const WORKFLOW_UID = 'api::transaction-workflow.transaction-workflow';
export const MEMBER_UID = 'api::member.member';

/** Tagi / Homály számlák — ugyanaz a kód-készlet, mint a member-accounts modulban. */
const MEMBER_CODES = new Set(['1101', '1001']);

export type AccountRef = {
  documentId: string;
  code?: string | number | null;
};

export type WorkflowStep = {
  description?: string | null;
  percent?: number | string | null;
  debit_account?: AccountRef | null;
  credit_account?: AccountRef | null;
  currency_type?: { documentId: string } | null;
  transaction_type?: { documentId: string } | null;
  organization?: { documentId: string } | null;
  copy_receipt?: boolean | null;
};

export type WorkflowTemplate = {
  documentId: string;
  name?: string | null;
  debit_account_code: number;
  credit_account_code: number;
  keep_original?: boolean | null;
  steps_published?: boolean | null;
  currency_type?: { documentId: string } | null;
  transaction_type?: { documentId: string } | null;
  step?: WorkflowStep[] | null;
};

export type SourceTransaction = {
  documentId: string;
  date: string;
  amount: number | string;
  description?: string | null;
  converted_to_workflow?: boolean | null;
  debit_account?: AccountRef | null;
  credit_account?: AccountRef | null;
  currency_type?: { documentId: string } | null;
  transaction_type?: { documentId: string } | null;
  organization?: { documentId: string } | null;
  receipts?: { documentId: string }[] | null;
  entered_by?: string | null;
};

export function parseAccountCode(
  code: string | number | null | undefined,
): number | null {
  if (code === null || code === undefined || code === '') return null;
  const value = Number(code);
  return Number.isFinite(value) ? value : null;
}

export function accountCodeString(
  account: AccountRef | null | undefined,
): string | null {
  const parsed = parseAccountCode(account?.code ?? null);
  return parsed === null ? null : String(parsed);
}

export function workflowMatchesTransaction(
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
): boolean {
  if (transaction.converted_to_workflow === true) return false;
  const debit = parseAccountCode(transaction.debit_account?.code ?? null);
  const credit = parseAccountCode(transaction.credit_account?.code ?? null);
  if (debit !== workflow.debit_account_code) return false;
  if (credit !== workflow.credit_account_code) return false;
  if (workflow.currency_type?.documentId) {
    if (transaction.currency_type?.documentId !== workflow.currency_type.documentId) {
      return false;
    }
  }
  if (workflow.transaction_type?.documentId) {
    if (
      transaction.transaction_type?.documentId !==
      workflow.transaction_type.documentId
    ) {
      return false;
    }
  }
  return true;
}

export function pickMatchingWorkflow(
  workflows: WorkflowTemplate[],
  transaction: SourceTransaction,
): WorkflowTemplate | null {
  const matches = workflows.filter((workflow) =>
    workflowMatchesTransaction(workflow, transaction),
  );
  if (matches.length > 1) {
    throw new TransactionWorkflowError(
      'Multiple published transaction-workflow templates match the same transaction',
      409,
    );
  }
  return matches[0] ?? null;
}

export function expandDescription(
  template: string | null | undefined,
  sourceDescription: string | null | undefined,
): string {
  const pattern = template?.trim() || '{1}';
  if (pattern.includes('{1}')) {
    return pattern.split('{1}').join(sourceDescription?.trim() || '');
  }
  return pattern;
}

export function stepAmount(
  sourceAmount: number | string,
  percent: number | string,
): number {
  const base = Number(sourceAmount);
  const ratio = Number(percent);
  if (!Number.isFinite(base) || !Number.isFinite(ratio)) {
    throw new TransactionWorkflowError(
      'Invalid amount or percent for expand',
      422,
    );
  }
  return (base * ratio) / 100;
}

function memberAccountOnSource(
  transaction: SourceTransaction,
): AccountRef | null {
  for (const side of [
    transaction.debit_account,
    transaction.credit_account,
  ] as const) {
    const code = accountCodeString(side);
    if (code && MEMBER_CODES.has(code)) return side ?? null;
  }
  return null;
}

export function resolveStepAccount(
  stepAccount: AccountRef | null | undefined,
  transaction: SourceTransaction,
  siblingByCode: ReadonlyMap<string, AccountRef>,
): AccountRef {
  const wanted = accountCodeString(stepAccount);
  if (!wanted || !MEMBER_CODES.has(wanted)) {
    if (!stepAccount?.documentId) {
      throw new TransactionWorkflowError(
        'Step account relation is missing',
        422,
      );
    }
    return stepAccount;
  }

  for (const side of [
    transaction.debit_account,
    transaction.credit_account,
  ] as const) {
    if (accountCodeString(side) === wanted && side?.documentId) {
      return side;
    }
  }

  const sibling = siblingByCode.get(wanted);
  if (sibling?.documentId) return sibling;

  throw new TransactionWorkflowError(
    `Could not resolve member account code ${wanted} from source transaction`,
    422,
  );
}

export type ExpandedStepRow = {
  index: number;
  description: string;
  amount: number;
  debit_account: AccountRef;
  credit_account: AccountRef;
  currency_type: { documentId: string };
  transaction_type?: { documentId: string } | null;
  organization: { documentId: string };
  copy_receipt: boolean;
  entered_key: string;
};

export function expandWorkflowSteps(
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
  siblingByCode: ReadonlyMap<string, AccountRef>,
): ExpandedStepRow[] {
  const steps = workflow.step ?? [];
  if (!steps.length) {
    throw new TransactionWorkflowError('Workflow has no steps', 422);
  }

  return steps.map((step, index) => {
    const currency = step.currency_type?.documentId;
    const organization = step.organization?.documentId;
    if (!currency || !organization) {
      throw new TransactionWorkflowError(
        'Step currency_type or organization is missing',
        422,
      );
    }

    return {
      index,
      description: expandDescription(step.description, transaction.description),
      amount: stepAmount(transaction.amount, step.percent ?? 100),
      debit_account: resolveStepAccount(
        step.debit_account,
        transaction,
        siblingByCode,
      ),
      credit_account: resolveStepAccount(
        step.credit_account,
        transaction,
        siblingByCode,
      ),
      currency_type: { documentId: currency },
      transaction_type: step.transaction_type?.documentId
        ? { documentId: step.transaction_type.documentId }
        : null,
      organization: { documentId: organization },
      copy_receipt: step.copy_receipt === true,
      entered_key: `${transaction.documentId}:step:${index}`,
    };
  });
}

export function buildSiblingMap(
  memberAccount: AccountRef | null,
  memberRow: {
    account?: AccountRef | null;
    private_account?: AccountRef | null;
  } | null,
): Map<string, AccountRef> {
  const map = new Map<string, AccountRef>();
  if (!memberRow) return map;
  for (const side of [memberRow.account, memberRow.private_account] as const) {
    const code = accountCodeString(side);
    if (code && side?.documentId) {
      map.set(code, side);
    }
  }
  if (memberAccount?.documentId) {
    const code = accountCodeString(memberAccount);
    if (code) map.set(code, memberAccount);
  }
  return map;
}

export function memberAccountFromTransaction(
  transaction: SourceTransaction,
): AccountRef | null {
  return memberAccountOnSource(transaction);
}

export function stornoEnteredKey(originalDocumentId: string): string {
  return `${originalDocumentId}:storno`;
}

export function assertKeepOriginalReceiptPolicy(
  keepOriginal: boolean,
  source: SourceTransaction,
  steps: ExpandedStepRow[],
): void {
  if (keepOriginal) return;
  const hasReceipts = (source.receipts?.length ?? 0) > 0;
  if (!hasReceipts) return;
  const anyCopy = steps.some((step) => step.copy_receipt);
  if (!anyCopy) {
    throw new TransactionWorkflowError(
      'Source transaction has receipts but no step sets copy_receipt',
      422,
    );
  }
}
