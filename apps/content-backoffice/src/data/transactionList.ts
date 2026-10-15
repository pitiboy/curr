export type PublicationStatus = 'draft' | 'published';

export type StrapiTransaction = {
  id?: number;
  documentId?: string;
  date?: string | null;
  createdAt?: string | null;
  publishedAt?: string | null;
  entered_by?: string | null;
  published_by?: string | null;
  amount?: string | number | null;
  description?: string | null;
  currency_type?: {
    documentId?: string;
    code?: string | null;
    name?: string | null;
    icon?: { url?: string | null } | { url?: string | null }[] | null;
  } | null;
  organization?: { documentId?: string; name?: string | null } | null;
  debit_account?: {
    documentId?: string;
    code?: string | null;
    name?: string | null;
  } | null;
  credit_account?: {
    documentId?: string;
    code?: string | null;
    name?: string | null;
  } | null;
  receipts?: Array<{
    documentId?: string;
    vendor?: string | null;
    document?: { url?: string | null } | { url?: string | null }[] | null;
    receipt_type?: { documentId?: string; name?: string | null } | null;
  }> | null;
};

/** Vendor of the first receipt, or an empty string when there is none. */
export function firstReceiptVendor(receipts: unknown): string {
  if (!Array.isArray(receipts) || receipts.length === 0) return '';
  const first = receipts[0];
  if (!first || typeof first !== 'object') return '';
  const vendor = (first as { vendor?: unknown }).vendor;
  return typeof vendor === 'string' ? vendor.trim() : '';
}

/**
 * One-level relations, plus the currency icon and each receipt file url.
 * A star on these relations is rejected: organization.parent and the file
 * `related` morph are not valid populate keys.
 */
export const transactionPopulate = {
  organization: true,
  debit_account: true,
  credit_account: true,
  currency_type: {
    populate: {
      icon: { fields: ['url', 'name', 'mime'] },
    },
  },
  receipts: {
    populate: {
      document: { fields: ['url', 'name', 'mime'] },
      receipt_type: true,
    },
  },
};

export type TransactionRow = Omit<StrapiTransaction, 'id'> & {
  id: string;
  documentId: string;
  status: PublicationStatus;
};

type ListParams = {
  filter?: Record<string, unknown>;
  sort?: { field?: string; order?: 'ASC' | 'DESC' };
  pagination?: { page?: number; perPage?: number };
};

/**
 * Strapi REST returns one publication status per request, and a published
 * document still has a draft row with the same documentId. The readonly list
 * keeps a single row and prefers the published version.
 */
export function assembleTransactionList(
  drafts: StrapiTransaction[],
  published: StrapiTransaction[],
  params: ListParams,
): { data: TransactionRow[]; total: number } {
  const { status } = buildTransactionFilters(params.filter ?? {});
  const merged = mergeByStatus(drafts, published, status).filter((row) =>
    matchesFirstReceiptVendor(row.receipts, params.filter?.vendor),
  );
  const sorted = sortTransactionRows(
    merged,
    params.sort?.field || 'date',
    params.sort?.order || 'DESC',
  );
  const page = params.pagination?.page || 1;
  const perPage = params.pagination?.perPage || 10;
  const start = (page - 1) * perPage;
  return { data: sorted.slice(start, start + perPage), total: sorted.length };
}

export function buildTransactionFilters(filter: Record<string, unknown>): {
  status?: PublicationStatus;
  strapiFilters: Record<string, unknown>;
} {
  const status =
    filter.status === 'draft' || filter.status === 'published'
      ? filter.status
      : undefined;
  const strapiFilters: Record<string, unknown> = {};

  const date: Record<string, string> = {};
  const dateFrom = asDate(filter.date_gte);
  const dateTo = asDate(filter.date_lte);
  if (dateFrom) date.$gte = dateFrom;
  if (dateTo) date.$lte = dateTo;
  if (Object.keys(date).length > 0) strapiFilters.date = date;

  const createdAt: Record<string, string> = {};
  const createdFrom = asDateTimeBound(filter.createdAt_gte, 'start');
  const createdTo = asDateTimeBound(filter.createdAt_lte, 'end');
  if (createdFrom) createdAt.$gte = createdFrom;
  if (createdTo) createdAt.$lte = createdTo;
  if (Object.keys(createdAt).length > 0) strapiFilters.createdAt = createdAt;

  const amount: Record<string, unknown> = {};
  if (isPresent(filter.amount_gte)) amount.$gte = filter.amount_gte;
  if (isPresent(filter.amount_lte)) amount.$lte = filter.amount_lte;
  if (Object.keys(amount).length > 0) strapiFilters.amount = amount;
  if (isPresent(filter.organization)) {
    strapiFilters.organization = { documentId: { $eq: filter.organization } };
  }
  if (isPresent(filter.debit_account)) {
    strapiFilters.debit_account = {
      documentId: { $eq: filter.debit_account },
    };
  }
  if (isPresent(filter.credit_account)) {
    strapiFilters.credit_account = {
      documentId: { $eq: filter.credit_account },
    };
  }
  if (typeof filter.description === 'string' && filter.description.trim()) {
    strapiFilters.description = { $containsi: filter.description.trim() };
  }
  if (typeof filter.vendor === 'string' && filter.vendor.trim()) {
    strapiFilters.receipts = { vendor: { $containsi: filter.vendor.trim() } };
  }

  return { status, strapiFilters };
}

export function encodeStrapiQuery(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  appendQuery(params, '', query);
  return params.toString();
}

function mergeByStatus(
  drafts: StrapiTransaction[],
  published: StrapiTransaction[],
  status?: PublicationStatus,
): TransactionRow[] {
  const publishedRows = uniqueByDocumentId(published).map((row) =>
    toListRecord(row, 'published'),
  );
  if (status === 'published') return publishedRows;

  const publishedIds = new Set(publishedRows.map((row) => row.documentId));
  const draftOnly = uniqueByDocumentId(drafts)
    .filter((row) => row.documentId && !publishedIds.has(row.documentId))
    .map((row) => toListRecord(row, 'draft'));
  if (status === 'draft') return draftOnly;
  return [...draftOnly, ...publishedRows];
}

function toListRecord(
  raw: StrapiTransaction,
  status: PublicationStatus,
): TransactionRow {
  const { id: _numericId, documentId, ...rest } = raw;
  return {
    ...rest,
    id: documentId as string,
    documentId: documentId as string,
    status,
  };
}

/** A published version wins over the draft with the same documentId. */
export function preferTransaction(
  draft: StrapiTransaction | null,
  published: StrapiTransaction | null,
): TransactionRow | null {
  if (published?.documentId) return toListRecord(published, 'published');
  if (draft?.documentId) return toListRecord(draft, 'draft');
  return null;
}

function uniqueByDocumentId(rows: StrapiTransaction[]): StrapiTransaction[] {
  const seen = new Set<string>();
  const unique: StrapiTransaction[] = [];
  for (const row of rows) {
    if (!row.documentId || seen.has(row.documentId)) continue;
    seen.add(row.documentId);
    unique.push(row);
  }
  return unique;
}

function sortTransactionRows(
  rows: TransactionRow[],
  field: string,
  order: 'ASC' | 'DESC',
): TransactionRow[] {
  const direction = order === 'ASC' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = sortValue(left, field);
    const b = sortValue(right, field);
    if (typeof a === 'number' && typeof b === 'number') {
      return (a - b) * direction;
    }
    return String(a).localeCompare(String(b), 'hu') * direction;
  });
}

function sortValue(row: TransactionRow, field: string): string | number {
  switch (field) {
    case 'amount':
      return toNumber(row.amount);
    case 'organization':
      return row.organization?.name ?? '';
    case 'debit_account':
      return accountSortKey(row.debit_account);
    case 'credit_account':
      return accountSortKey(row.credit_account);
    case 'receipt':
    case 'receipts':
      return Array.isArray(row.receipts) ? row.receipts.length : 0;
    case 'status':
      return row.status;
    case 'description':
      return row.description ?? '';
    case 'date':
      return row.date ?? '';
    case 'createdAt':
      return row.createdAt ?? '';
    case 'publishedAt':
      return row.publishedAt ?? '';
    case 'entered_by':
      return row.entered_by ?? '';
    case 'published_by':
      return row.published_by ?? '';
    case 'currency_type':
      return currencySortKey(row.currency_type);
    case 'vendor':
      return firstReceiptVendor(row.receipts);
    default: {
      const value = (row as Record<string, unknown>)[field];
      if (typeof value === 'number' || typeof value === 'string') return value;
      return '';
    }
  }
}

function accountSortKey(
  account: TransactionRow['debit_account'],
): string {
  if (!account) return '';
  return [account.code, account.name].filter(Boolean).join(' ');
}

function currencySortKey(
  currency: TransactionRow['currency_type'],
): string {
  if (!currency) return '';
  return [currency.code, currency.name].filter(Boolean).join(' ');
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchesFirstReceiptVendor(receipts: unknown, query: unknown): boolean {
  if (typeof query !== 'string' || !query.trim()) return true;
  const vendor = firstReceiptVendor(receipts).toLocaleLowerCase('hu');
  return vendor.includes(query.trim().toLocaleLowerCase('hu'));
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function asDate(value: unknown): string | undefined {
  if (!isPresent(value)) return undefined;
  const text = String(value);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : text;
}

/** createdAt is a datetime, so a picked calendar day covers that whole UTC day. */
function asDateTimeBound(
  value: unknown,
  edge: 'start' | 'end',
): string | undefined {
  const date = asDate(value);
  if (!date) return undefined;
  return edge === 'start'
    ? `${date}T00:00:00.000Z`
    : `${date}T23:59:59.999Z`;
}

function appendQuery(
  params: URLSearchParams,
  prefix: string,
  value: unknown,
): void {
  if (value === undefined || value === null || value === '') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendQuery(params, `${prefix}[${index}]`, item);
    });
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      appendQuery(params, prefix ? `${prefix}[${key}]` : key, child);
    }
    return;
  }
  params.append(prefix, String(value));
}
