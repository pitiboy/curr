export type PublicationStatus = 'draft' | 'published';

/** Source row after Convert. */
export const CONVERTED_ORIGINAL = 'original' as const;
/** Step row from Convert. */
export const CONVERTED_EXPANDED = 'expanded' as const;
/** Storno row from Convert. */
export const CONVERTED_STORNO = 'storno' as const;
/** Multiselect sentinel: rows with null/empty converted_to_workflow. */
export const CONVERTED_FILTER_NONE = 'none' as const;

export type ConvertedToWorkflow =
  | typeof CONVERTED_ORIGINAL
  | typeof CONVERTED_EXPANDED
  | typeof CONVERTED_STORNO;

export type ConvertedFilterValue =
  | typeof CONVERTED_FILTER_NONE
  | ConvertedToWorkflow;

export const CONVERTED_TO_WORKFLOW_CHOICES = [
  CONVERTED_FILTER_NONE,
  CONVERTED_EXPANDED,
  CONVERTED_STORNO,
  CONVERTED_ORIGINAL,
] as const;

/** Default list filter: hide `original` and `storno` rows. */
export const DEFAULT_CONVERTED_FILTER: ConvertedFilterValue[] = [
  CONVERTED_FILTER_NONE,
  CONVERTED_EXPANDED,
];

/** True when Convert may still match the row (null/empty only). */
export function isExpandableConvertedValue(
  value: ConvertedToWorkflow | boolean | null | undefined | '',
): boolean {
  // Legacy boolean false (pre-enum) still counts as expandable.
  return value == null || value === '' || value === false;
}

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
  converted_to_workflow?: ConvertedToWorkflow | boolean | null;
  transaction_type?: { documentId?: string } | null;
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
  /** React-admin id: Strapi documentId (not the numeric PK). */
  id: string;
  documentId: string;
  /** Strapi numeric primary key for list display/sort. */
  entryId?: number;
  status: PublicationStatus;
};

/** Published `transaction-workflow` header fields used for Convert match (no steps). */
export type WorkflowTemplateHeader = {
  documentId: string;
  name?: string | null;
  debit_account_code: number;
  credit_account_code: number;
  currency_type?: { documentId?: string } | null;
  transaction_type?: { documentId?: string } | null;
};

export type TransactionWorkflowMatchInput = Pick<
  StrapiTransaction,
  | 'converted_to_workflow'
  | 'debit_account'
  | 'credit_account'
  | 'currency_type'
  | 'transaction_type'
>;

function parseAccountCode(
  code: string | number | null | undefined,
): number | null {
  if (code === null || code === undefined || code === '') return null;
  const value = Number(code);
  return Number.isFinite(value) ? value : null;
}

/** Same rules as server `workflowMatchesTransaction` in `src/transaction-workflow/convert.ts`. */
export function workflowMatchesTransaction(
  workflow: WorkflowTemplateHeader,
  transaction: TransactionWorkflowMatchInput,
): boolean {
  if (!isExpandableConvertedValue(transaction.converted_to_workflow)) {
    return false;
  }
  const debit = parseAccountCode(transaction.debit_account?.code ?? null);
  const credit = parseAccountCode(transaction.credit_account?.code ?? null);
  if (debit !== workflow.debit_account_code) return false;
  if (credit !== workflow.credit_account_code) return false;
  if (workflow.currency_type?.documentId) {
    if (
      transaction.currency_type?.documentId !== workflow.currency_type.documentId
    ) {
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

/**
 * Client pick: 0 → null, 1 → template, >1 → null (server convert throws 409).
 */
export function pickMatchingWorkflow(
  workflows: WorkflowTemplateHeader[],
  transaction: TransactionWorkflowMatchInput,
): WorkflowTemplateHeader | null {
  const matches = workflows.filter((workflow) =>
    workflowMatchesTransaction(workflow, transaction),
  );
  if (matches.length !== 1) return null;
  return matches[0] ?? null;
}

export function transactionLikeFromRecord(
  record: TransactionWorkflowMatchInput,
): TransactionWorkflowMatchInput {
  return {
    converted_to_workflow: record.converted_to_workflow,
    debit_account: record.debit_account,
    credit_account: record.credit_account,
    currency_type: record.currency_type,
    transaction_type: record.transaction_type,
  };
}

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
    params.sort?.field || 'entryId',
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
  // Always constrain the enum filter: empty / missing → hide `original`.
  const convertedClauses = convertedToWorkflowFilterClauses(
    normalizeConvertedFilter(filter.converted_to_workflow) ?? [
      ...DEFAULT_CONVERTED_FILTER,
    ],
  );
  if (convertedClauses.length === 1) {
    Object.assign(strapiFilters, convertedClauses[0]);
  } else if (convertedClauses.length > 1) {
    strapiFilters.$or = convertedClauses;
  }

  return { status, strapiFilters };
}

/** Normalize List multiselect → Strapi `$null` / `$eq` / `$in` clauses. */
export function convertedToWorkflowFilterClauses(
  raw: unknown,
): Record<string, unknown>[] {
  const selected = normalizeConvertedFilter(raw);
  if (!selected || selected.length === 0) return [];

  const includeNull = selected.includes(CONVERTED_FILTER_NONE);
  const enums = selected.filter(
    (value): value is ConvertedToWorkflow =>
      value === CONVERTED_ORIGINAL ||
      value === CONVERTED_EXPANDED ||
      value === CONVERTED_STORNO,
  );

  const clauses: Record<string, unknown>[] = [];
  if (includeNull) {
    clauses.push({ converted_to_workflow: { $null: true } });
  }
  if (enums.length === 1) {
    clauses.push({ converted_to_workflow: { $eq: enums[0] } });
  } else if (enums.length > 1) {
    clauses.push({ converted_to_workflow: { $in: enums } });
  }
  return clauses;
}

export function normalizeConvertedFilter(
  raw: unknown,
): ConvertedFilterValue[] | undefined {
  if (raw == null || raw === '') return undefined;
  const list = Array.isArray(raw) ? raw : [raw];
  const values: ConvertedFilterValue[] = [];
  for (const item of list) {
    if (
      item === CONVERTED_FILTER_NONE ||
      item === CONVERTED_ORIGINAL ||
      item === CONVERTED_EXPANDED ||
      item === CONVERTED_STORNO
    ) {
      if (!values.includes(item)) values.push(item);
    }
  }
  return values.length > 0 ? values : undefined;
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
  const { id: entryId, documentId, ...rest } = raw;
  return {
    ...rest,
    id: documentId as string,
    documentId: documentId as string,
    entryId: typeof entryId === 'number' ? entryId : undefined,
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
    case 'entryId':
    case 'id':
      return typeof row.entryId === 'number' ? row.entryId : 0;
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

function accountSortKey(account: TransactionRow['debit_account']): string {
  if (!account) return '';
  return [account.code, account.name].filter(Boolean).join(' ');
}

function currencySortKey(currency: TransactionRow['currency_type']): string {
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
  return edge === 'start' ? `${date}T00:00:00.000Z` : `${date}T23:59:59.999Z`;
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
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      appendQuery(params, prefix ? `${prefix}[${key}]` : key, child);
    }
    return;
  }
  params.append(prefix, String(value));
}
