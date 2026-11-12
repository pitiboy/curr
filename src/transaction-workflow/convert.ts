/**
 * Convert üzleti logika (Strapi nélkül, tesztelhető).
 * Match: published sablon fejléc minták (glob * / ? vagy heurisztikus regex) +
 * opcionális pénznem/típus; converted_to_workflow üres (null) —
 * original/expanded/storno nem matchel.
 * Expand: step percent → összeg, {original.*}/{1} leírás;
 * organization/debit/credit/currency_from_original (forrás kötelező a flaghez)
 * vagy step relation (üres marad üres orgnál);
 * tagi oldal forrás trx / testvér számlából.
 * apply_currency_rate step: amount × currency-rate (forrás pénznem → step pénznem,
 * legfrissebb valid_from ≤ forrás nap vége) × tagsági ratio (csak valódi váltásnál,
 * `rules[forrás pénznem kód]`), 2 tizedes; rate-et és ratio-t a hívó oldja fel.
 * Hibák: TransactionWorkflowError HTTP státusszal (409 ütköző sablon, 422 hiányzó adat),
 * opcionális gépi `code` (pl. CURRENCY_RATE_MISSING) és `details`.
 */

/** Source row after convert. */
export const CONVERTED_ORIGINAL = 'original' as const;
/** Step row produced by convert. */
export const CONVERTED_EXPANDED = 'expanded' as const;
/** Storno row produced by convert (keep_original). */
export const CONVERTED_STORNO = 'storno' as const;

export type ConvertedToWorkflow =
  | typeof CONVERTED_ORIGINAL
  | typeof CONVERTED_EXPANDED
  | typeof CONVERTED_STORNO;

/** True when the row can still be matched / expanded (null/empty only). */
export function isExpandableConvertedValue(
  value: ConvertedToWorkflow | boolean | null | undefined | '',
): boolean {
  // Legacy boolean false (pre-enum) still counts as expandable.
  return value == null || value === '' || value === false;
}
export const ERROR_CURRENCY_RATE_MISSING = 'CURRENCY_RATE_MISSING' as const;
export const ERROR_CURRENCY_RATE_INVALID = 'CURRENCY_RATE_INVALID' as const;
export const ERROR_MEMBERSHIP_RATIO_AMBIGUOUS =
  'MEMBERSHIP_RATIO_AMBIGUOUS' as const;

export class TransactionWorkflowError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TransactionWorkflowError';
    this.status = status;
    if (code) this.code = code;
    if (details) this.details = details;
  }
}

export const TRANSACTION_UID = 'api::transaction.transaction';
export const WORKFLOW_UID = 'api::transaction-workflow.transaction-workflow';
export const MEMBER_UID = 'api::member.member';

export const STEP_RELATED = 'workflow.step';
export const STEP_MEMBER_DEBIT = 'workflow.step-member-debit';
export const STEP_MEMBER_CREDIT = 'workflow.step-member-credit';

/** Tagi / Homály számlák — ugyanaz a kód-készlet, mint a member-accounts modulban. */
export const MEMBER_ACCOUNT_CODES = new Set(['1101', '1001']);

export type AccountRef = {
  documentId: string;
  code?: string | number | null;
};

/** Which source trx side to copy onto a step debit/credit. */
export type OriginalAccountSide = 'debit' | 'credit';

export type WorkflowStep = {
  __component?: string | null;
  description?: string | null;
  percent?: number | string | null;
  member_account_code?: string | number | null;
  debit_account?: AccountRef | null;
  credit_account?: AccountRef | null;
  /**
   * Copy source debit or credit onto this step's debit.
   * Legacy boolean `true` = same-side (`debit`).
   */
  debit_account_from_original?: OriginalAccountSide | boolean | null;
  /**
   * Copy source debit or credit onto this step's credit.
   * Legacy boolean `true` = same-side (`credit`).
   */
  credit_account_from_original?: OriginalAccountSide | boolean | null;
  currency_type?: CurrencyRef | null;
  currency_from_original?: boolean | null;
  transaction_type?: { documentId: string } | null;
  organization?: { documentId: string } | null;
  organization_from_original?: boolean | null;
  copy_receipt?: boolean | null;
  apply_currency_rate?: boolean | null;
};

export type NormalizedWorkflowStep = {
  description?: string | null;
  percent?: number | string | null;
  debitWanted: string;
  creditWanted: string;
  debitRelation?: AccountRef | null;
  creditRelation?: AccountRef | null;
  /** When set, expand copies that source side onto step debit. */
  debit_from_original?: OriginalAccountSide | null;
  /** When set, expand copies that source side onto step credit. */
  credit_from_original?: OriginalAccountSide | null;
  currency_from_original?: boolean;
  currency_type?: { documentId: string; code?: string | null } | null;
  transaction_type?: { documentId: string } | null;
  organization?: { documentId: string } | null;
  organization_from_original?: boolean | null;
  copy_receipt?: boolean | null;
  apply_currency_rate?: boolean;
};

export type WorkflowTemplate = {
  documentId: string;
  name?: string | null;
  debit_account_code: string | number;
  credit_account_code: string | number;
  keep_original?: boolean | null;
  steps_published?: boolean | null;
  currency_type?: { documentId: string } | null;
  transaction_type?: { documentId: string } | null;
  step?: WorkflowStep[] | null;
};

/** Currency ref as populated on steps / source (code optional). */
export type CurrencyRef = {
  documentId: string;
  code?: string | null;
};

export type SourceTransaction = {
  documentId: string;
  date: string;
  amount: number | string;
  description?: string | null;
  converted_to_workflow?: ConvertedToWorkflow | boolean | null;
  debit_account?: AccountRef | null;
  credit_account?: AccountRef | null;
  currency_type?: {
    documentId: string;
    code?: string | null;
    name?: string | null;
  } | null;
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

/**
 * Relation may be a populated `{ documentId }` or a bare documentId string.
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

export function isMemberAccountCode(
  code: string | number | null | undefined,
): boolean {
  const normalized = parseAccountCode(code);
  return normalized !== null && MEMBER_ACCOUNT_CODES.has(String(normalized));
}

function requireMemberAccountCode(
  code: string | number | null | undefined,
): string {
  const normalized = parseAccountCode(code);
  if (normalized === null || !MEMBER_ACCOUNT_CODES.has(String(normalized))) {
    throw new TransactionWorkflowError(
      `Invalid member_account_code "${code ?? ''}" (expected 1101 or 1001)`,
      422,
    );
  }
  return String(normalized);
}

function requireRelationCode(
  account: AccountRef | null | undefined,
  side: 'debit' | 'credit',
): string {
  const code = accountCodeString(account);
  if (!account?.documentId || !code) {
    throw new TransactionWorkflowError(
      `Step ${side}_account relation is missing or has no code`,
      422,
    );
  }
  return code;
}

/**
 * Characters that force regex mode (not glob). `?` and `*` stay glob-only so
 * `15?0` / `5*` keep Excel/shell meaning.
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
 * Glob (`*` / `?`) or heuristic regex match against an account code.
 * Invalid regex → false (no throw). Empty pattern → false.
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

function resolveCurrencySide(
  step: WorkflowStep,
): Pick<NormalizedWorkflowStep, 'currency_type' | 'currency_from_original'> {
  if (step.currency_from_original === true) {
    return { currency_from_original: true, currency_type: null };
  }
  if (!step.currency_type?.documentId) {
    throw new TransactionWorkflowError('Step currency_type is missing', 422);
  }
  return {
    currency_from_original: false,
    currency_type: step.currency_type,
  };
}

/**
 * Parse from_original enum (or legacy boolean true → same-side default).
 */
export function parseOriginalAccountSide(
  value: OriginalAccountSide | boolean | null | undefined,
  sameSideDefault: OriginalAccountSide,
): OriginalAccountSide | null {
  if (value === true) return sameSideDefault;
  if (value === 'debit' || value === 'credit') return value;
  return null;
}

function resolveAccountSide(
  step: WorkflowStep,
  side: OriginalAccountSide,
): {
  wanted: string;
  relation: AccountRef | null | undefined;
  fromOriginal: OriginalAccountSide | null;
} {
  const fromOriginal = parseOriginalAccountSide(
    side === 'debit'
      ? step.debit_account_from_original
      : step.credit_account_from_original,
    side,
  );
  if (fromOriginal) {
    return { wanted: '', relation: null, fromOriginal };
  }
  const account = side === 'debit' ? step.debit_account : step.credit_account;
  return {
    wanted: requireRelationCode(account, side),
    relation: account,
    fromOriginal: null,
  };
}

/** Dynamic-zone komponens → egységes debit/credit wanted + relation. */
export function normalizeWorkflowStep(
  step: WorkflowStep,
): NormalizedWorkflowStep {
  const component = step.__component?.trim();
  if (!component) {
    throw new TransactionWorkflowError(
      'Workflow step __component is required',
      422,
    );
  }

  const currency = resolveCurrencySide(step);
  const shared = {
    description: step.description,
    percent: step.percent,
    ...currency,
    transaction_type: step.transaction_type,
    organization: step.organization,
    organization_from_original: step.organization_from_original === true,
    copy_receipt: step.copy_receipt,
    apply_currency_rate: step.apply_currency_rate === true,
  };

  if (component === STEP_RELATED) {
    const debit = resolveAccountSide(step, 'debit');
    const credit = resolveAccountSide(step, 'credit');
    return {
      ...shared,
      debitWanted: debit.wanted,
      creditWanted: credit.wanted,
      debitRelation: debit.relation,
      creditRelation: credit.relation,
      debit_from_original: debit.fromOriginal,
      credit_from_original: credit.fromOriginal,
    };
  }

  if (component === STEP_MEMBER_DEBIT) {
    const debitWanted = requireMemberAccountCode(step.member_account_code);
    const credit = resolveAccountSide(step, 'credit');
    return {
      ...shared,
      debitWanted,
      creditWanted: credit.wanted,
      debitRelation: null,
      creditRelation: credit.relation,
      debit_from_original: null,
      credit_from_original: credit.fromOriginal,
    };
  }

  if (component === STEP_MEMBER_CREDIT) {
    const creditWanted = requireMemberAccountCode(step.member_account_code);
    const debit = resolveAccountSide(step, 'debit');
    return {
      ...shared,
      debitWanted: debit.wanted,
      creditWanted,
      debitRelation: debit.relation,
      creditRelation: null,
      debit_from_original: debit.fromOriginal,
      credit_from_original: null,
    };
  }

  throw new TransactionWorkflowError(
    `Unknown workflow step component "${component}"`,
    422,
  );
}

export function workflowMatchesTransaction(
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
): boolean {
  if (!isExpandableConvertedValue(transaction.converted_to_workflow)) {
    return false;
  }
  const debit = accountCodeString(transaction.debit_account);
  const credit = accountCodeString(transaction.credit_account);
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

/** Scalar fields readable via `{original.<field>}` in step description templates. */
const ORIGINAL_STRING_FIELDS = [
  'description',
  'date',
  'amount',
  'entered_by',
] as const;

type OriginalStringField = (typeof ORIGINAL_STRING_FIELDS)[number];

function requireSourceAccount(
  source: SourceTransaction,
  side: 'debit' | 'credit',
): AccountRef {
  const account =
    side === 'debit' ? source.debit_account : source.credit_account;
  if (!account?.documentId) {
    throw new TransactionWorkflowError(
      `Source transaction ${side}_account is required by this workflow step`,
      422,
    );
  }
  return account;
}

function requireSourceCurrency(source: SourceTransaction): CurrencyRef {
  const documentId = source.currency_type?.documentId;
  if (!documentId) {
    throw new TransactionWorkflowError(
      'Source transaction currency_type is required by this workflow step',
      422,
    );
  }
  return {
    documentId,
    code: source.currency_type?.code ?? null,
  };
}

function originalFieldValue(source: SourceTransaction, field: string): string {
  if (field === 'debit_account_code') {
    return accountCodeString(source.debit_account) ?? '';
  }
  if (field === 'credit_account_code') {
    return accountCodeString(source.credit_account) ?? '';
  }
  if (field === 'currency') {
    return source.currency_type?.code?.trim() ?? '';
  }
  if (!(ORIGINAL_STRING_FIELDS as readonly string[]).includes(field)) {
    return '';
  }
  const value = source[field as OriginalStringField];
  if (value == null) return '';
  return String(value);
}

/**
 * Expand `{original.<field>}` and legacy `{1}` (= `{original.description}`).
 * Empty source values become empty strings — no invented defaults.
 */
export function expandTemplate(
  template: string | null | undefined,
  source: SourceTransaction,
): string {
  const pattern = template?.trim() || '{1}';
  const withLegacy = pattern.includes('{1}')
    ? pattern.split('{1}').join('{original.description}')
    : pattern;
  return withLegacy.replace(
    /\{original\.([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (_match, field: string) => originalFieldValue(source, field),
  );
}

/** @deprecated Prefer expandTemplate; kept for call-site compatibility. */
export function expandDescription(
  template: string | null | undefined,
  sourceDescription: string | null | undefined,
): string {
  return expandTemplate(template, {
    documentId: '',
    date: '',
    amount: 0,
    description: sourceDescription,
  });
}

/** True when any step copies organization from the source transaction. */
export function workflowRequiresSourceOrganization(
  workflow: Pick<WorkflowTemplate, 'step'>,
): boolean {
  return (workflow.step ?? []).some(
    (step) => step?.organization_from_original === true,
  );
}

export function resolveStepOrganization(
  step: Pick<
    NormalizedWorkflowStep,
    'organization' | 'organization_from_original'
  >,
  source: SourceTransaction,
): { documentId: string } | null {
  if (step.organization_from_original) {
    const documentId = source.organization?.documentId;
    return documentId ? { documentId } : null;
  }
  const documentId = step.organization?.documentId;
  return documentId ? { documentId } : null;
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
    if (code && MEMBER_ACCOUNT_CODES.has(code)) return side ?? null;
  }
  return null;
}

export function resolveStepAccount(
  wantedCode: string | null,
  stepAccount: AccountRef | null | undefined,
  transaction: SourceTransaction,
  siblingByCode: ReadonlyMap<string, AccountRef>,
): AccountRef {
  if (!wantedCode) {
    throw new TransactionWorkflowError('Step account code is missing', 422);
  }

  if (MEMBER_ACCOUNT_CODES.has(wantedCode)) {
    for (const side of [
      transaction.debit_account,
      transaction.credit_account,
    ] as const) {
      if (accountCodeString(side) === wantedCode && side?.documentId) {
        return side;
      }
    }

    const sibling = siblingByCode.get(wantedCode);
    if (sibling?.documentId) return sibling;

    throw new TransactionWorkflowError(
      `Could not resolve member account code ${wantedCode} from source transaction`,
      422,
    );
  }

  if (!stepAccount?.documentId) {
    throw new TransactionWorkflowError(
      `Step account relation missing for code ${wantedCode}`,
      422,
    );
  }
  return stepAccount;
}

/** Rate actually used for an `apply_currency_rate` step. */
export type AppliedRate = {
  fromCurrencyDocumentId: string;
  toCurrencyDocumentId: string;
  rate: number;
  /** null when from === to (implicit rate 1, no lookup). */
  validFrom: string | null;
  currencyRateDocumentId: string | null;
};

/** Member ratio for the source currency (membership-ratio.ts resolves it). */
export type MemberRatio = {
  ratio: number;
  membershipDocumentId: string | null;
  membershipName: string | null;
  /** 'membership' when the membership overrides, 'membership_type' otherwise. */
  source: 'membership' | 'membership_type';
};

/** Description suffix for a step whose amount used a ratio ≠ 1 (audit trail). */
export function memberRatioDescriptionSuffix(
  memberRatio: MemberRatio | null | undefined,
): string {
  if (!memberRatio || memberRatio.ratio === 1) return '';
  const label = memberRatio.membershipName
    ? ` (${memberRatio.membershipName})`
    : '';
  return ` · ratio ${memberRatio.ratio}${label}`;
}

/** Resolved rates keyed by step (target) currency documentId; source currency is fixed per call. */
export type RateByCurrency = ReadonlyMap<string, AppliedRate>;

/** Currency-rate row reduced to what the lookup needs. */
export type CurrencyRateRow = {
  documentId?: string | null;
  rate: number | string;
  valid_from: string;
  fromCurrencyDocumentId: string;
  toCurrencyDocumentId: string;
};

/** `YYYY-MM-DD` of the transaction date (accepts full ISO timestamps). */
export function isoDay(date: string): string {
  return String(date ?? '').slice(0, 10);
}

/** Inclusive UTC end of the given day — same rule as backoffice pickLatestCurrencyRate. */
export function rateCutoff(date: string): string {
  return `${isoDay(date)}T23:59:59.999Z`;
}

/** Two-decimal rounding for rate-applied amounts (matches saleRevenueAmount). */
export function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Latest direct `from → to` row with valid_from ≤ end of `date` (UTC).
 * No inverse fallback. Same currency → rate 1 without a row.
 */
export function pickLatestRate(
  rows: readonly CurrencyRateRow[],
  fromCurrencyDocumentId: string,
  toCurrencyDocumentId: string,
  date: string,
): AppliedRate | null {
  if (fromCurrencyDocumentId === toCurrencyDocumentId) {
    return {
      fromCurrencyDocumentId,
      toCurrencyDocumentId,
      rate: 1,
      validFrom: null,
      currencyRateDocumentId: null,
    };
  }
  const cutoff = Date.parse(rateCutoff(date));
  let best: CurrencyRateRow | null = null;
  let bestTime = -Infinity;
  for (const row of rows) {
    if (row.fromCurrencyDocumentId !== fromCurrencyDocumentId) continue;
    if (row.toCurrencyDocumentId !== toCurrencyDocumentId) continue;
    const time = Date.parse(row.valid_from);
    if (!Number.isFinite(time) || time > cutoff) continue;
    if (time > bestTime) {
      best = row;
      bestTime = time;
    }
  }
  if (!best) return null;
  return {
    fromCurrencyDocumentId,
    toCurrencyDocumentId,
    rate: Number(best.rate),
    validFrom: best.valid_from,
    currencyRateDocumentId: best.documentId ?? null,
  };
}

/** True when any step of the template asks for a currency-rate conversion. */
export function workflowAppliesCurrencyRate(
  workflow: Pick<WorkflowTemplate, 'step'>,
): boolean {
  return (workflow.step ?? []).some(
    (step) => step?.apply_currency_rate === true,
  );
}

/**
 * Target currency documentIds that need a rate lookup (flagged steps whose
 * currency differs from the source). Source currency is required when any step is flagged.
 */
export function stepsNeedingRate(
  workflow: Pick<WorkflowTemplate, 'step'>,
  source: SourceTransaction,
): { from: string; to: string[] } | null {
  if (!workflowAppliesCurrencyRate(workflow)) return null;
  const from = source.currency_type?.documentId;
  if (!from) {
    throw new TransactionWorkflowError(
      'Source transaction currency_type is required for apply_currency_rate steps',
      422,
    );
  }
  const to = new Set<string>();
  for (const step of workflow.step ?? []) {
    if (step?.apply_currency_rate !== true) continue;
    // currency_from_original → same as source → no lookup.
    if (step.currency_from_original === true) continue;
    const target = step.currency_type?.documentId;
    if (target && target !== from) to.add(target);
  }
  return { from, to: [...to] };
}

function currencyLabel(ref: CurrencyRef | null | undefined): string {
  return ref?.code?.trim() || ref?.documentId || '';
}

/** Rate for one flagged step, or a 422 with a machine-readable code. */
function requireStepRate(
  stepCurrency: CurrencyRef,
  source: SourceTransaction,
  rates: RateByCurrency | undefined,
): AppliedRate {
  const from = source.currency_type?.documentId;
  if (!from) {
    throw new TransactionWorkflowError(
      'Source transaction currency_type is required for apply_currency_rate steps',
      422,
    );
  }
  if (from === stepCurrency.documentId) {
    return pickLatestRate([], from, from, source.date) as AppliedRate;
  }
  const details = {
    from: currencyLabel(source.currency_type),
    to: currencyLabel(stepCurrency),
    date: isoDay(source.date),
  };
  const applied = rates?.get(stepCurrency.documentId);
  if (!applied) {
    throw new TransactionWorkflowError(
      `Currency rate ${details.from} → ${details.to} not found on or before ${details.date}`,
      422,
      ERROR_CURRENCY_RATE_MISSING,
      details,
    );
  }
  if (!Number.isFinite(applied.rate) || applied.rate <= 0) {
    throw new TransactionWorkflowError(
      `Currency rate ${details.from} → ${details.to} is invalid (${applied.rate})`,
      422,
      ERROR_CURRENCY_RATE_INVALID,
      { ...details, rate: applied.rate },
    );
  }
  return applied;
}

export type ExpandedStepRow = {
  index: number;
  description: string;
  amount: number;
  debit_account: AccountRef;
  credit_account: AccountRef;
  currency_type: { documentId: string };
  transaction_type?: { documentId: string } | null;
  organization: { documentId: string } | null;
  copy_receipt: boolean;
  entered_key: string;
  /** Set only on apply_currency_rate steps. */
  appliedRate: AppliedRate | null;
  /** Set when the member ratio multiplied this step (real conversion only). */
  memberRatio: MemberRatio | null;
};

export function expandWorkflowSteps(
  workflow: WorkflowTemplate,
  transaction: SourceTransaction,
  siblingByCode: ReadonlyMap<string, AccountRef>,
  rates?: RateByCurrency,
  memberRatio?: MemberRatio | null,
): ExpandedStepRow[] {
  const steps = workflow.step ?? [];
  if (!steps.length) {
    throw new TransactionWorkflowError('Workflow has no steps', 422);
  }
  if (
    workflowRequiresSourceOrganization(workflow) &&
    !transaction.organization?.documentId
  ) {
    throw new TransactionWorkflowError(
      'Source transaction organization is required by this workflow template',
      422,
    );
  }

  return steps.map((step, index) => {
    const normalized = normalizeWorkflowStep(step);
    const stepCurrency = normalized.currency_from_original
      ? requireSourceCurrency(transaction)
      : normalized.currency_type;
    const currency = stepCurrency?.documentId;
    if (!currency) {
      throw new TransactionWorkflowError('Step currency_type is missing', 422);
    }

    const baseAmount = stepAmount(
      transaction.amount,
      normalized.percent ?? 100,
    );
    const appliedRate = normalized.apply_currency_rate
      ? requireStepRate(stepCurrency as CurrencyRef, transaction, rates)
      : null;

    // Ratio only on a real conversion (from ≠ to): a flagged same-currency
    // step (e.g. EGG count) must never be scaled.
    const stepRatio =
      appliedRate &&
      memberRatio &&
      appliedRate.fromCurrencyDocumentId !== appliedRate.toCurrencyDocumentId
        ? memberRatio
        : null;

    const debit_account = normalized.debit_from_original
      ? requireSourceAccount(transaction, normalized.debit_from_original)
      : resolveStepAccount(
          normalized.debitWanted,
          normalized.debitRelation,
          transaction,
          siblingByCode,
        );
    const credit_account = normalized.credit_from_original
      ? requireSourceAccount(transaction, normalized.credit_from_original)
      : resolveStepAccount(
          normalized.creditWanted,
          normalized.creditRelation,
          transaction,
          siblingByCode,
        );

    return {
      index,
      description:
        expandTemplate(normalized.description, transaction) +
        memberRatioDescriptionSuffix(stepRatio),
      amount: appliedRate
        ? roundAmount(baseAmount * appliedRate.rate * (stepRatio?.ratio ?? 1))
        : baseAmount,
      debit_account,
      credit_account,
      currency_type: { documentId: currency },
      transaction_type: normalized.transaction_type?.documentId
        ? { documentId: normalized.transaction_type.documentId }
        : null,
      organization: resolveStepOrganization(normalized, transaction),
      copy_receipt: normalized.copy_receipt === true,
      entered_key: `${transaction.documentId}:step:${index}`,
      appliedRate,
      memberRatio: stepRatio,
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

/** Storno row amount mirrors the source with inverted sign. */
export function stornoAmountFromSource(sourceAmount: number | string): number {
  return -Number(sourceAmount);
}

export type StornoRowShape = {
  amount: number;
  date: string;
  description: string | null | undefined;
  debit_account: AccountRef | null | undefined;
  credit_account: AccountRef | null | undefined;
  currency_type: { documentId: string };
  organization: { documentId: string } | null;
  transaction_type: { documentId: string } | undefined;
  related_transaction: { documentId: string };
  entered_key: string;
};

/** Payload fields shared by convert storno create and convert preview. */
export function buildStornoRowShape(
  transaction: SourceTransaction,
): StornoRowShape {
  const currencyDocumentId = transaction.currency_type?.documentId;
  if (!currencyDocumentId) {
    throw new TransactionWorkflowError(
      'Source transaction currency_type is required for convert',
      422,
    );
  }
  const organizationDocumentId = transaction.organization?.documentId;
  return {
    date: transaction.date,
    amount: stornoAmountFromSource(transaction.amount),
    description: transaction.description,
    debit_account: transaction.debit_account,
    credit_account: transaction.credit_account,
    currency_type: { documentId: currencyDocumentId },
    organization: organizationDocumentId
      ? { documentId: organizationDocumentId }
      : null,
    transaction_type: transaction.transaction_type?.documentId
      ? { documentId: transaction.transaction_type.documentId }
      : undefined,
    related_transaction: { documentId: transaction.documentId },
    entered_key: stornoEnteredKey(transaction.documentId),
  };
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
