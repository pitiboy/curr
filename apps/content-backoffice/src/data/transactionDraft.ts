import {
  assertReceiptShared,
  createReceiptDraft,
  receiptAttachments,
  type ContentHttpClient,
} from './receiptDraft';

/** REST create without this query publishes, and dataentry publish is 403. */
export function transactionDraftUrl(strapiUrl: string): string {
  return `${strapiUrl}/api/transactions?status=draft`;
}

export function transactionUpdateDraftUrl(
  strapiUrl: string,
  documentId: string,
): string {
  return `${strapiUrl}/api/transactions/${encodeURIComponent(documentId)}?status=draft`;
}

/**
 * Whitelist of the create form. Audit fields and the workflow relations
 * stay off the payload even if they arrive in the form data.
 */
export function transactionDraftBody(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  const date = asDate(input.date);
  if (date) body.date = date;
  if (isAmount(input.amount)) body.amount = input.amount;

  if (typeof input.description === 'string' && input.description.trim()) {
    body.description = input.description.trim();
  }

  for (const key of [
    'organization',
    'debit_account',
    'credit_account',
    'currency_type',
  ] as const) {
    const value = relationId(input[key]);
    if (value) body[key] = value;
  }

  return body;
}

export async function createTransactionDraft(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  data: Record<string, unknown>,
) {
  const body = transactionDraftBody(data);
  const attachments = receiptAttachments(data.receipt_cards);
  if (attachments.length > 0) {
    assertReceiptShared({
      date: body.date,
      amount: body.amount,
      description: body.description,
    });
  }
  const { json } = await httpClient(transactionDraftUrl(strapiUrl), {
    method: 'POST',
    body: JSON.stringify({ data: body }),
  });
  const created = recordData(json);
  const documentId =
    typeof created.documentId === 'string' ? created.documentId : '';
  for (const attachment of attachments) {
    await createReceiptDraft(httpClient, strapiUrl, {
      file: attachment.file,
      vendor: attachment.vendor,
      receiptTypeId: attachment.receiptTypeId,
      transactionId: documentId,
      date: body.date,
      amount: body.amount,
      description: body.description,
    });
  }
  return {
    data: {
      ...created,
      id: documentId,
      documentId,
    },
  };
}

export async function updateTransactionDraft(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  documentId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const body = transactionDraftBody(data);
  await httpClient(transactionUpdateDraftUrl(strapiUrl, documentId), {
    method: 'PUT',
    body: JSON.stringify({ data: body }),
  });
}

function recordData(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== 'object' || !('data' in json)) return {};
  const data = (json as { data?: unknown }).data;
  return data && typeof data === 'object'
    ? (data as Record<string, unknown>)
    : {};
}

function asDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : undefined;
}

function isAmount(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim() !== '';
  return false;
}

function relationId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}
