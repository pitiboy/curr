import { classifyLedgerMovement } from '../pages/reports/projectBalance/projectBalance.classify';

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
  typeof CONVERTED_FILTER_NONE | ConvertedToWorkflow;

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
  transaction_type?: {
    documentId?: string;
    name?: string | null;
  } | null;
  receipts?: Array<{
    documentId?: string;
    vendor?: string | null;
    document?: { url?: string | null } | { url?: string | null }[] | null;
    receipt_type?: { documentId?: string; name?: string | null } | null;
  }> | null;
  related_transaction?: {
    documentId?: string;
    date?: string | null;
    amount?: string | number | null;
    description?: string | null;
    converted_to_workflow?: ConvertedToWorkflow | boolean | null;
    currency_type?: { code?: string | null; name?: string | null } | null;
  } | null;
  related_transactions?: Array<{
    documentId?: string;
    date?: string | null;
    amount?: string | number | null;
    description?: string | null;
    converted_to_workflow?: ConvertedToWorkflow | boolean | null;
    currency_type?: { code?: string | null; name?: string | null } | null;
  }> | null;
};

export function parseTransactionAmount(
  value: string | number | null | undefined,
): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number(
    String(value ?? '')
      .replace(',', '.')
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function currencyCodeFromRow(
  currency: StrapiTransaction['currency_type'],
): string {
  if (!currency || typeof currency !== 'object') return '—';
  const code = currency.code?.trim();
  if (code) return code;
  const name = currency.name?.trim();
  return name || '—';
}

/** Sum amounts on the current list page, grouped by currency code. */
export function sumTransactionAmountsByCurrency(
  rows: ReadonlyArray<Pick<StrapiTransaction, 'amount' | 'currency_type'>>,
): { currency: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const amount = parseTransactionAmount(row.amount);
    const code = currencyCodeFromRow(row.currency_type);
    totals.set(code, (totals.get(code) ?? 0) + amount);
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

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
  related_transaction: {
    fields: [
      'id',
      'documentId',
      'date',
      'amount',
      'description',
      'converted_to_workflow',
    ],
    populate: {
      currency_type: { fields: ['code', 'name'] },
      debit_account: { fields: ['code', 'name'] },
      credit_account: { fields: ['code', 'name'] },
    },
  },
  related_transactions: {
    fields: [
      'id',
      'documentId',
      'date',
      'amount',
      'description',
      'converted_to_workflow',
    ],
    populate: {
      currency_type: { fields: ['code', 'name'] },
      debit_account: { fields: ['code', 'name'] },
      credit_account: { fields: ['code', 'name'] },
    },
  },
  currency_type: {
    populate: {
      icon: { fields: ['url', 'name', 'mime'] },
    },
  },
  transaction_type: { fields: ['documentId', 'name'] },
  receipts: {
    populate: {
      document: { fields: ['url', 'name', 'mime'] },
      receipt_type: true,
    },
  },
};

/** Client-only list filter from project balance drill-down (not sent to Strapi). */
export const PROJECT_BALANCE_LEG_FILTER_KEY = 'project_balance_leg' as const;

/** Client-only: exclude tagi 1101/1001 belső átvezetések (membership-share riport). */
export const MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY =
  'membership_share_external' as const;

/**
 * Client-only Tagság kimutatás drill-down mód.
 * `payment` = külső jóváírás; `deduction` = kivét; `balance` = mindkettő (ignorált belső tételek nélkül).
 */
export const MEMBERSHIP_LEDGER_MODE_FILTER_KEY =
  'membership_ledger_mode' as const;

export type MembershipLedgerModeFilter = 'payment' | 'deduction' | 'balance';

/**
 * Strapi: credit OR debit account documentId `$in` (balance / tag név drill-down).
 */
export const MEMBER_LEDGER_ACCOUNT_IN_FILTER_KEY =
  'member_ledger_account_in' as const;

/** Strapi `credit_account.documentId.$in` a membership-share drill-downból. */
export const CREDIT_ACCOUNT_IN_FILTER_KEY = 'credit_account_in' as const;

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
  debit_account_code: string | number;
  credit_account_code: string | number;
  currency_type?: {
    documentId?: string;
    code?: string | null;
    name?: string | null;
  } | null;
  transaction_type?: {
    documentId?: string;
    name?: string | null;
  } | null;
  /**
   * True when any step uses `organization_from_original` — Create must set
   * organization, and Convert rejects an empty source org.
   */
  requires_source_organization: boolean;
};

export type TransactionWorkflowMatchInput = {
  converted_to_workflow?: StrapiTransaction['converted_to_workflow'];
  debit_account?: StrapiTransaction['debit_account'];
  credit_account?: StrapiTransaction['credit_account'];
  /** Populated object or bare documentId from a form ReferenceInput. */
  currency_type?: StrapiTransaction['currency_type'] | string | null;
  /** Populated object or bare documentId from a form ReferenceInput. */
  transaction_type?: StrapiTransaction['transaction_type'] | string | null;
};

function parseAccountCode(
  code: string | number | null | undefined,
): number | null {
  if (code === null || code === undefined || code === '') return null;
  const value = Number(code);
  return Number.isFinite(value) ? value : null;
}

function accountCodeString(
  code: string | number | null | undefined,
): string | null {
  const parsed = parseAccountCode(code);
  return parsed === null ? null : String(parsed);
}

/**
 * Relation may be a populated object or a bare documentId string (form
 * ReferenceInput / flattened review record).
 */
export function relationDocumentId(
  value: { documentId?: string } | string | null | undefined,
): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (value && typeof value === 'object') {
    const documentId = value.documentId;
    if (typeof documentId === 'string' && documentId.trim()) {
      return documentId.trim();
    }
  }
  return null;
}

/**
 * Characters that force regex mode (not glob). Same rules as server
 * `accountCodeMatchesPattern` in `src/transaction-workflow/convert.ts`.
 */
const ACCOUNT_CODE_REGEX_TRIGGERS = /[[\](){}\\.^$|]/;

/** Exact 4-digit account code (prefill / $eq safe). */
export function isExactAccountCodePattern(
  pattern: string | number | null | undefined,
): boolean {
  if (pattern === null || pattern === undefined || pattern === '') return false;
  return /^[0-9]{4}$/.test(String(pattern).trim());
}

/**
 * Glob (`*` / `?`) or heuristic regex match. Same rules as server convert.ts.
 */
export function accountCodeMatchesPattern(
  code: string | number | null | undefined,
  pattern: string | number | null | undefined,
): boolean {
  if (code === null || code === undefined || code === '') return false;
  if (pattern === null || pattern === undefined || pattern === '') return false;
  const codeStr = String(code).trim();
  const patternStr = String(pattern).trim();
  if (!codeStr || !patternStr) return false;

  const useRegex = ACCOUNT_CODE_REGEX_TRIGGERS.test(patternStr);
  const body = useRegex
    ? patternStr
    : patternStr.replace(/\*/g, '[0-9]*').replace(/\?/g, '[0-9]');
  try {
    return new RegExp(`^${body}$`).test(codeStr);
  } catch {
    return false;
  }
}

/** Same rules as server `workflowMatchesTransaction` in `src/transaction-workflow/convert.ts`. */
export function workflowMatchesTransaction(
  workflow: WorkflowTemplateHeader,
  transaction: TransactionWorkflowMatchInput,
): boolean {
  if (!isExpandableConvertedValue(transaction.converted_to_workflow)) {
    return false;
  }
  const debit = accountCodeString(transaction.debit_account?.code ?? null);
  const credit = accountCodeString(transaction.credit_account?.code ?? null);
  if (!accountCodeMatchesPattern(debit, workflow.debit_account_code)) {
    return false;
  }
  if (!accountCodeMatchesPattern(credit, workflow.credit_account_code)) {
    return false;
  }
  const workflowCurrencyId = relationDocumentId(workflow.currency_type);
  if (workflowCurrencyId) {
    if (relationDocumentId(transaction.currency_type) !== workflowCurrencyId) {
      return false;
    }
  }
  const workflowTypeId = relationDocumentId(workflow.transaction_type);
  if (workflowTypeId) {
    if (relationDocumentId(transaction.transaction_type) !== workflowTypeId) {
      return false;
    }
  }
  return true;
}

export function countMatchingWorkflows(
  workflows: WorkflowTemplateHeader[],
  transaction: TransactionWorkflowMatchInput,
): number {
  return workflows.filter((workflow) =>
    workflowMatchesTransaction(workflow, transaction),
  ).length;
}

/**
 * Client pick: 0 → null, 1 → template, >1 → null (server convert throws 409).
 */
export function pickMatchingWorkflow(
  workflows: WorkflowTemplateHeader[],
  transaction: TransactionWorkflowMatchInput,
): WorkflowTemplateHeader | null {
  if (countMatchingWorkflows(workflows, transaction) !== 1) return null;
  return (
    workflows.find((workflow) =>
      workflowMatchesTransaction(workflow, transaction),
    ) ?? null
  );
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
  const filter = params.filter ?? {};
  const leg = filter[PROJECT_BALANCE_LEG_FILTER_KEY];
  const membershipExternal = filter[MEMBERSHIP_SHARE_EXTERNAL_FILTER_KEY];
  const membershipLedgerMode = filter[MEMBERSHIP_LEDGER_MODE_FILTER_KEY];
  const merged = mergeByStatus(drafts, published, status).filter(
    (row) =>
      matchesFirstReceiptVendor(row.receipts, filter.vendor) &&
      matchesProjectBalanceLeg(row, leg) &&
      matchesMembershipShareExternal(row, membershipExternal) &&
      matchesMembershipLedgerMode(row, membershipLedgerMode),
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
  const statusRaw = Array.isArray(filter.status)
    ? filter.status[0]
    : filter.status;
  const status =
    statusRaw === 'draft' || statusRaw === 'published' ? statusRaw : undefined;
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
  if (typeof filter.currency_type === 'string' && filter.currency_type.trim()) {
    strapiFilters.currency_type = {
      code: { $eq: filter.currency_type.trim() },
    };
  }
  const memberLedgerAccountIn = normalizeStringIdList(
    filter[MEMBER_LEDGER_ACCOUNT_IN_FILTER_KEY],
  );
  if (memberLedgerAccountIn && memberLedgerAccountIn.length > 0) {
    const idFilter =
      memberLedgerAccountIn.length === 1
        ? { documentId: { $eq: memberLedgerAccountIn[0] } }
        : { documentId: { $in: memberLedgerAccountIn } };
    // Sibling `$or` would clash with converted `$or` — fold into `$and` below.
    strapiFilters.__memberLedgerAccountOr = {
      $or: [{ credit_account: idFilter }, { debit_account: idFilter }],
    };
  } else if (isPresent(filter.debit_account)) {
    strapiFilters.debit_account = {
      documentId: { $eq: filter.debit_account },
    };
  }
  const creditAccountIn = normalizeStringIdList(
    filter[CREDIT_ACCOUNT_IN_FILTER_KEY],
  );
  if (!memberLedgerAccountIn?.length) {
    if (creditAccountIn?.length === 1) {
      strapiFilters.credit_account = {
        documentId: { $eq: creditAccountIn[0] },
      };
    } else if (creditAccountIn && creditAccountIn.length > 1) {
      strapiFilters.credit_account = {
        documentId: { $in: creditAccountIn },
      };
    } else if (isPresent(filter.credit_account)) {
      strapiFilters.credit_account = {
        documentId: { $eq: filter.credit_account },
      };
    } else if (
      typeof filter.credit_account_code === 'string' &&
      filter.credit_account_code.trim()
    ) {
      strapiFilters.credit_account = {
        code: { $eq: filter.credit_account_code.trim() },
      };
    }
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
  const memberLedgerAccountOr = strapiFilters.__memberLedgerAccountOr as
    Record<string, unknown> | undefined;
  delete strapiFilters.__memberLedgerAccountOr;

  const andParts: Record<string, unknown>[] = [];
  if (convertedClauses.length === 1) {
    Object.assign(strapiFilters, convertedClauses[0]);
  } else if (convertedClauses.length > 1) {
    andParts.push({ $or: convertedClauses });
  }
  if (memberLedgerAccountOr) {
    andParts.push(memberLedgerAccountOr);
  }
  if (andParts.length === 1) {
    Object.assign(strapiFilters, andParts[0]);
  } else if (andParts.length > 1) {
    strapiFilters.$and = andParts;
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

const MEMBER_LEDGER_DEBIT_CODES = new Set(['1101', '1001']);
/** Same cohort as membershipShare `isTreasuryKorMovement` (1900 ↔ 1101 KOR). */
const TREASURY_CLEARING_ACCOUNT_CODE = '1900';
const MEMBER_SHARE_ACCOUNT_CODE = '1101';
const KOR_CURRENCY_CODE = 'KOR';

function matchesMembershipShareExternal(
  row: Pick<
    StrapiTransaction,
    'debit_account' | 'credit_account' | 'currency_type'
  >,
  enabled: unknown,
): boolean {
  if (enabled !== true) return true;
  const debitCode = String(row.debit_account?.code ?? '').trim();
  const creditCode = String(row.credit_account?.code ?? '').trim();
  const currencyCode = String(row.currency_type?.code ?? '').trim();
  const touchesTreasury =
    debitCode === TREASURY_CLEARING_ACCOUNT_CODE ||
    creditCode === TREASURY_CLEARING_ACCOUNT_CODE;
  const touchesShare =
    debitCode === MEMBER_SHARE_ACCOUNT_CODE ||
    creditCode === MEMBER_SHARE_ACCOUNT_CODE;
  if (currencyCode === KOR_CURRENCY_CODE && touchesTreasury && touchesShare) {
    return false;
  }
  return !MEMBER_LEDGER_DEBIT_CODES.has(debitCode);
}

const SHARE_CAPITAL_ACCOUNT_CODE = '3000';

function isIgnoredPocketDeductionCredit(creditCode: string): boolean {
  if (
    creditCode === SHARE_CAPITAL_ACCOUNT_CODE ||
    creditCode === TREASURY_CLEARING_ACCOUNT_CODE ||
    creditCode === '1000' ||
    creditCode === '1100' ||
    creditCode === '1200' ||
    creditCode === '4200'
  ) {
    return true;
  }
  return /^5/.test(creditCode);
}

function isTreasuryKorRow(
  row: Pick<
    StrapiTransaction,
    'debit_account' | 'credit_account' | 'currency_type'
  >,
): boolean {
  const debitCode = String(row.debit_account?.code ?? '').trim();
  const creditCode = String(row.credit_account?.code ?? '').trim();
  const currencyCode = String(row.currency_type?.code ?? '').trim();
  if (currencyCode !== KOR_CURRENCY_CODE) return false;
  const touchesTreasury =
    debitCode === TREASURY_CLEARING_ACCOUNT_CODE ||
    creditCode === TREASURY_CLEARING_ACCOUNT_CODE;
  if (!touchesTreasury) return false;
  return (
    debitCode === MEMBER_SHARE_ACCOUNT_CODE ||
    creditCode === MEMBER_SHARE_ACCOUNT_CODE
  );
}

/**
 * Tagság kimutatás drill-down kliens szűrő — igazodik a riport payment/deduction
 * szabályaihoz (belső átvezetés, 3000, pocket wash, treasury KOR).
 */
function matchesMembershipLedgerMode(
  row: Pick<
    StrapiTransaction,
    'debit_account' | 'credit_account' | 'currency_type'
  >,
  mode: unknown,
): boolean {
  if (mode !== 'payment' && mode !== 'deduction' && mode !== 'balance') {
    return true;
  }
  const debitCode = String(row.debit_account?.code ?? '').trim();
  const creditCode = String(row.credit_account?.code ?? '').trim();
  if (isTreasuryKorRow(row)) return false;
  if (
    MEMBER_LEDGER_DEBIT_CODES.has(debitCode) &&
    MEMBER_LEDGER_DEBIT_CODES.has(creditCode)
  ) {
    return false;
  }
  if (
    debitCode === SHARE_CAPITAL_ACCOUNT_CODE ||
    creditCode === SHARE_CAPITAL_ACCOUNT_CODE
  ) {
    return false;
  }

  if (mode === 'payment') {
    return (
      MEMBER_LEDGER_DEBIT_CODES.has(creditCode) &&
      !MEMBER_LEDGER_DEBIT_CODES.has(debitCode)
    );
  }

  if (mode === 'deduction') {
    if (!MEMBER_LEDGER_DEBIT_CODES.has(debitCode)) return false;
    if (MEMBER_LEDGER_DEBIT_CODES.has(creditCode)) return false;
    if (debitCode === MEMBER_SHARE_ACCOUNT_CODE) {
      return creditCode !== SHARE_CAPITAL_ACCOUNT_CODE;
    }
    if (debitCode === '1001') {
      return !isIgnoredPocketDeductionCredit(creditCode);
    }
    return false;
  }

  // balance: either external payment or counted deduction on a member ledger
  const isPayment =
    MEMBER_LEDGER_DEBIT_CODES.has(creditCode) &&
    !MEMBER_LEDGER_DEBIT_CODES.has(debitCode);
  if (isPayment) return true;
  if (!MEMBER_LEDGER_DEBIT_CODES.has(debitCode)) return false;
  if (debitCode === MEMBER_SHARE_ACCOUNT_CODE) return true;
  if (debitCode === '1001') return !isIgnoredPocketDeductionCredit(creditCode);
  return false;
}

function normalizeStringIdList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

function matchesProjectBalanceLeg(
  row: Pick<StrapiTransaction, 'debit_account' | 'credit_account'>,
  leg: unknown,
): boolean {
  if (leg !== 'revenue' && leg !== 'cost') return true;
  const kind = classifyLedgerMovement(
    row.debit_account?.code,
    row.credit_account?.code,
  );
  if (leg === 'revenue') return kind === 'revenue';
  return kind === 'cost';
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
