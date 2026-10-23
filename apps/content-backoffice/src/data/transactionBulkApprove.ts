import type { TransactionRow } from './transactionList';
import { isSamePersonPublishError } from './transactionPublish';
import {
  reviewFormDefaults,
  transactionPublishFormErrors,
} from '../pages/transactions/transactionForm';

export type BulkApproveSkipReason = 'not_draft' | 'incomplete' | 'same_person';

export type BulkApproveClassification = {
  ready: TransactionRow[];
  skipped: Array<{ record: TransactionRow; reason: BulkApproveSkipReason }>;
};

export type BulkPublishOutcome = {
  succeeded: string[];
  failed: Array<{ documentId: string; message: string; samePerson: boolean }>;
};

/** List-row publish without a form save: the stored draft must already be complete. */
export function classifyBulkApproveRows(
  records: TransactionRow[],
  editorEmail: string,
): BulkApproveClassification {
  const ready: TransactionRow[] = [];
  const skipped: BulkApproveClassification['skipped'] = [];
  const normalizedEditor = editorEmail.trim().toLowerCase();

  for (const record of records) {
    const reason = bulkApproveSkipReason(record, normalizedEditor);
    if (reason) skipped.push({ record, reason });
    else ready.push(record);
  }

  return { ready, skipped };
}

function bulkApproveSkipReason(
  record: TransactionRow,
  normalizedEditorEmail: string,
): BulkApproveSkipReason | null {
  if (record.status !== 'draft') return 'not_draft';

  const values = reviewFormDefaults(record);
  const incomplete =
    Object.keys(transactionPublishFormErrors(values, () => '')).length > 0;
  if (incomplete) return 'incomplete';

  const enteredBy =
    typeof record.entered_by === 'string' ? record.entered_by.trim() : '';
  if (
    normalizedEditorEmail &&
    enteredBy &&
    enteredBy.toLowerCase() === normalizedEditorEmail
  ) {
    return 'same_person';
  }

  return null;
}

export async function bulkPublishTransactions(
  documentIds: readonly string[],
  publish: (documentId: string) => Promise<void>,
): Promise<BulkPublishOutcome> {
  const succeeded: string[] = [];
  const failed: BulkPublishOutcome['failed'] = [];

  for (const documentId of documentIds) {
    try {
      await publish(documentId);
      succeeded.push(documentId);
    } catch (error: unknown) {
      const message = errorMessage(error);
      failed.push({
        documentId,
        message,
        samePerson: isSamePersonPublishError(message),
      });
    }
  }

  return { succeeded, failed };
}

function errorMessage(error: unknown): string {
  const body = (error as { body?: { error?: { message?: string } } }).body;
  const nested = body?.error?.message;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return '';
}
