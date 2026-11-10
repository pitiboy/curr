import {
  countMatchingWorkflows,
  isExpandableConvertedValue,
  pickMatchingWorkflow,
  type TransactionRow,
  type WorkflowTemplateHeader,
} from './transactionList';

export type BulkConvertSkipReason =
  'already_converted' | 'no_match' | 'ambiguous';

export type BulkConvertReadyItem = {
  record: TransactionRow;
  workflow: WorkflowTemplateHeader;
};

export type BulkConvertClassification = {
  ready: BulkConvertReadyItem[];
  skipped: Array<{ record: TransactionRow; reason: BulkConvertSkipReason }>;
};

export type BulkConvertJob = {
  transactionDocumentId: string;
  workflowDocumentId: string;
};

export type BulkConvertOutcome = {
  succeeded: string[];
  failed: Array<{
    transactionDocumentId: string;
    workflowDocumentId: string;
    message: string;
  }>;
};

/**
 * Bulk selection on the transaction list: a row is selectable when either
 * bulk action applies — finalize (draft) or convert (not yet expanded and
 * exactly one workflow template matches, same rule as the row convert button).
 */
export function isBulkActionSelectable(
  record: TransactionRow,
  workflows: readonly WorkflowTemplateHeader[],
): boolean {
  if (record.status === 'draft') return true;
  if (!isExpandableConvertedValue(record.converted_to_workflow)) return false;
  return pickMatchingWorkflow([...workflows], record) !== null;
}

export function classifyBulkConvertRows(
  records: TransactionRow[],
  workflows: WorkflowTemplateHeader[],
): BulkConvertClassification {
  const ready: BulkConvertReadyItem[] = [];
  const skipped: BulkConvertClassification['skipped'] = [];

  for (const record of records) {
    const reason = bulkConvertSkipReason(record, workflows);
    if (reason) {
      skipped.push({ record, reason });
      continue;
    }
    const workflow = pickMatchingWorkflow(workflows, record);
    if (!workflow) {
      skipped.push({ record, reason: 'no_match' });
      continue;
    }
    ready.push({ record, workflow });
  }

  return { ready, skipped };
}

function bulkConvertSkipReason(
  record: TransactionRow,
  workflows: WorkflowTemplateHeader[],
): BulkConvertSkipReason | null {
  if (!isExpandableConvertedValue(record.converted_to_workflow)) {
    return 'already_converted';
  }
  const matches = countMatchingWorkflows(workflows, record);
  if (matches === 0) return 'no_match';
  if (matches > 1) return 'ambiguous';
  return null;
}

export async function bulkConvertTransactions(
  items: readonly BulkConvertJob[],
  convert: (
    transactionDocumentId: string,
    workflowDocumentId: string,
  ) => Promise<unknown>,
): Promise<BulkConvertOutcome> {
  const succeeded: string[] = [];
  const failed: BulkConvertOutcome['failed'] = [];

  for (const item of items) {
    try {
      await convert(item.transactionDocumentId, item.workflowDocumentId);
      succeeded.push(item.transactionDocumentId);
    } catch (error: unknown) {
      failed.push({
        transactionDocumentId: item.transactionDocumentId,
        workflowDocumentId: item.workflowDocumentId,
        message: errorMessage(error),
      });
    }
  }

  return { succeeded, failed };
}

function errorMessage(error: unknown): string {
  const body = (error as { body?: { error?: { message?: string } } }).body;
  const nested = body?.error?.message;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();
  if (error instanceof Error && error.message.trim())
    return error.message.trim();
  return '';
}
