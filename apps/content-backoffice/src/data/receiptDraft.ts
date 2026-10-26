export type ContentHttpClient = (
  url: string,
  options?: { method?: string; body?: string | FormData },
) => Promise<{ json: unknown }>;

type ReceiptInput = {
  date: unknown;
  amount: unknown;
  description: unknown;
  vendor: unknown;
  transactionId: unknown;
  receiptTypeId: unknown;
};

type ReceiptPrefill = {
  date: string;
  amount: unknown;
  description: string;
  vendor: string;
  transaction: string;
  receipt_type: string;
};

export type ReceiptAttachment = {
  file: File;
  vendor: string;
  receiptTypeId: string;
};

/** Cards with a file. A file without a vendor or a type is rejected. */
export function receiptAttachments(input: unknown): ReceiptAttachment[] {
  if (!Array.isArray(input)) return [];
  const attachments: ReceiptAttachment[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const row = item as {
      file?: unknown;
      vendor?: unknown;
      receiptTypeId?: unknown;
    };
    if (!(row.file instanceof File) || row.file.size <= 0) continue;
    const vendor = typeof row.vendor === 'string' ? row.vendor.trim() : '';
    const receiptTypeId =
      typeof row.receiptTypeId === 'string' ? row.receiptTypeId.trim() : '';
    if (!vendor || !receiptTypeId) {
      throw new Error(
        'A vendor and a receipt type are required when a receipt file is attached.',
      );
    }
    attachments.push({ file: row.file, vendor, receiptTypeId });
  }
  return attachments;
}

/** Shared transaction fields every attached receipt copies. Throws before any HTTP. */
export function assertReceiptShared(input: {
  date: unknown;
  amount: unknown;
  description: unknown;
}): void {
  const date = asDateTime(input.date);
  if (!date || !isAmount(input.amount)) {
    throw new Error(
      'A date and amount are required when a receipt file is attached.',
    );
  }
  const description =
    typeof input.description === 'string' ? input.description.trim() : '';
  if (!description) {
    throw new Error(
      'A description is required when a receipt file is attached.',
    );
  }
}

export function receiptDraftBody(
  input: ReceiptInput & { document: number | string },
): Record<string, unknown> {
  return { ...receiptPrefill(input), document: input.document };
}

/**
 * Upload the file with the Content JWT, then create the receipt as a draft
 * linked to the transaction. The returned id is the receipt documentId.
 */
export async function createReceiptDraft(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  input: ReceiptInput & { file: File },
): Promise<string> {
  const prefill = receiptPrefill(input);
  const document = await uploadReceiptFile(httpClient, strapiUrl, input.file);
  const { json } = await httpClient(`${strapiUrl}/api/receipts?status=draft`, {
    method: 'POST',
    body: JSON.stringify({ data: { ...prefill, document } }),
  });
  return documentIdOf(json);
}

/** Create one draft receipt on an existing transaction. */
export async function attachReceiptToTransaction(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  documentId: string,
  input: Omit<ReceiptInput, 'transactionId'> & { file: File },
): Promise<string> {
  return createReceiptDraft(httpClient, strapiUrl, {
    ...input,
    transactionId: documentId,
  });
}

export function receiptCount(receipts: unknown): number {
  if (!Array.isArray(receipts)) return 0;
  return receipts.filter((item) => receiptIsPresent(item)).length;
}

/** A file without a vendor or a type cannot be saved. */
export function receiptCardInvalid(card: {
  file: File | null;
  vendor: string;
  receiptTypeId: string;
}): boolean {
  return Boolean(
    card.file &&
    card.file.size > 0 &&
    (!card.vendor.trim() || !card.receiptTypeId),
  );
}

export function receiptIsPresent(receipt: unknown): boolean {
  if (!receipt || typeof receipt !== 'object') return false;
  const documentId = (receipt as { documentId?: unknown }).documentId;
  return typeof documentId === 'string' && documentId.length > 0;
}

/** Absolute URL of the receipt file, or null when the relation has no document. */
export function receiptDocumentUrl(
  receipt: unknown,
  strapiUrl: string,
): string | null {
  const url = documentUrl(receipt);
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const origin = strapiUrl.replace(/\/$/, '');
  return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`;
}

function receiptPrefill(input: ReceiptInput): ReceiptPrefill {
  const date = asDateTime(input.date);
  if (!date || !isAmount(input.amount)) {
    throw new Error(
      'A date and amount are required when a receipt file is attached.',
    );
  }
  const description =
    typeof input.description === 'string' ? input.description.trim() : '';
  if (!description) {
    throw new Error(
      'A description is required when a receipt file is attached.',
    );
  }
  const vendor = typeof input.vendor === 'string' ? input.vendor.trim() : '';
  const transaction = relationId(input.transactionId);
  const receiptType = relationId(input.receiptTypeId);
  if (!vendor || !transaction || !receiptType) {
    throw new Error(
      'A vendor and a receipt type are required when a receipt file is attached.',
    );
  }
  return {
    date,
    amount: input.amount,
    description,
    vendor,
    transaction,
    receipt_type: receiptType,
  };
}

function relationId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

async function uploadReceiptFile(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  file: File,
): Promise<number | string> {
  const form = new FormData();
  form.append('files', file);
  const { json } = await httpClient(`${strapiUrl}/api/upload`, {
    method: 'POST',
    body: form,
  });
  return uploadedFileId(json);
}

function uploadedFileId(json: unknown): number | string {
  const entry = firstRecord(json);
  if (!entry) throw new Error('The upload did not return a file.');
  const id = entry.id;
  if (typeof id === 'number' && Number.isFinite(id)) return id;
  if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id);
  if (typeof entry.documentId === 'string' && entry.documentId) {
    return entry.documentId;
  }
  throw new Error('The upload did not return a file id.');
}

function documentIdOf(json: unknown): string {
  if (!json || typeof json !== 'object' || !('data' in json)) {
    throw new Error('The receipt create did not return a document.');
  }
  const data = (json as { data?: unknown }).data;
  const documentId =
    data && typeof data === 'object'
      ? (data as { documentId?: unknown }).documentId
      : undefined;
  if (typeof documentId !== 'string' || !documentId) {
    throw new Error('The receipt create did not return a documentId.');
  }
  return documentId;
}

function firstRecord(json: unknown): Record<string, unknown> | null {
  const value = Array.isArray(json) ? json[0] : json;
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function documentUrl(receipt: unknown): string | null {
  if (!receipt || typeof receipt !== 'object') return null;
  const document = (receipt as { document?: unknown }).document;
  const file = Array.isArray(document) ? document[0] : document;
  if (!file || typeof file !== 'object') return null;
  const url = (file as { url?: unknown }).url;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

function asDateTime(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (!match) return undefined;
  return trimmed === match[1] ? `${match[1]}T00:00:00.000Z` : trimmed;
}

function isAmount(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim() !== '';
  return false;
}
