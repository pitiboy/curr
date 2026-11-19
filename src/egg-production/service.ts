/**
 * Napi tojás űrlap — Strapi réteg: `POST /api/egg-production/entries`.
 *
 * 1. bemenet validálás (dátum, ólak, tagok, conflictChoice)
 * 2. `egg-production` feature flag + szerep (dataentry / editor / controller)
 * 3. szervezeti hatókör: dataentry / editor csak a saját szervezeteire
 *    (minden láb szervezete), controller bármire
 * 4. törzsadat + sablonok + tagságok + árfolyam → `buildEggEntryPlan`
 * 5. duplikátum (dátum + szervezet + pénznem + T/K) → conflictChoice
 * 6. írás egyetlen `strapi.db.transaction`-ben; bármely hiba → semmi nem marad
 *    (opcionálisan auto-publish ugyanabban a tranzakcióban, `eggAuto` szabályokkal)
 *
 * `dryRun`: ugyanaz a terv és duplikátum lista, írás nélkül.
 */
import {
  TransactionWorkflowError,
  WORKFLOW_UID,
  TRANSACTION_UID,
  type AccountRef,
  type AppliedRate,
  type CurrencyRef,
  type WorkflowTemplate,
} from '../transaction-workflow/convert';
import {
  createRateResolver,
  type ConvertContextStrapi,
} from '../transaction-workflow/convert-context';
import { loadBackofficeFeatureRows } from '../backoffice-features/load';
import {
  BACKOFFICE_SETTING_KEYS,
  DEFAULT_EGG_SALE_CURRENCY,
} from '../backoffice-features/constants';
import { rolesFromFeatureConfig } from '../backoffice-features/parse';
import type { BackofficeFeatureRow } from '../backoffice-features/types';
import { withPublishGuardLinked } from '../publish-guard';
import {
  ORG_SCOPE_BYPASS_CONTENT_ROLE_TYPES,
  ORG_SCOPE_CONTENT_ROLE_TYPES,
} from '../org-scope-middleware';
import {
  EGG_CURRENCY_CODE,
  EGG_PRODUCTION_FEATURE_KEY,
  EGG_WORKFLOW_TEMPLATE_NAMES,
  POULTRY_STOCK_ORGANIZATION_NAME,
  type EggWorkflowTemplateRole,
} from './constants';
import { membershipValidOnDate } from './distribution';
import { resolveEggRule } from './membership-rules';
import {
  EGG_CONFLICT_CHOICES,
  buildEggEntryPlan,
  matchEggDuplicates,
  resolveEggLegActions,
  type EggConflictChoice,
  type EggDistributionInput,
  type EggLegAction,
  type EggPlanTemplates,
  type EggPlanWarning,
  type EggProductionInput,
  type ExistingEggTransaction,
  type ResolvedEggLeg,
} from './plan';

const ORGANIZATION_UID = 'api::organization.organization';
const CURRENCY_TYPE_UID = 'api::currency-type.currency-type';
const MEMBERSHIP_UID = 'api::membership.membership';
const USER_UID = 'plugin::users-permissions.user';

/** Roles allowed when the Settings row has no `config.roles`. */
export const EGG_PRODUCTION_DEFAULT_ROLES = [
  'dataentry',
  'editor',
  'controller',
] as const;

export const EGG_ERROR = {
  validation: 'EGG_VALIDATION',
  unauthenticated: 'EGG_UNAUTHENTICATED',
  featureDisabled: 'EGG_FEATURE_DISABLED',
  roleForbidden: 'EGG_ROLE_FORBIDDEN',
  orgScopeDenied: 'EGG_ORG_SCOPE_DENIED',
  masterDataMissing: 'EGG_MASTER_DATA_MISSING',
  templateMissing: 'EGG_TEMPLATE_MISSING',
  conflictChoiceRequired: 'EGG_CONFLICT_CHOICE_REQUIRED',
  writeFailed: 'EGG_WRITE_FAILED',
} as const;

type DocumentsApi = {
  findMany: (params?: Record<string, unknown>) => Promise<unknown[]>;
  create: (params: Record<string, unknown>) => Promise<unknown>;
  update: (params: Record<string, unknown>) => Promise<unknown>;
  publish: (params: { documentId: string }) => Promise<unknown>;
};

type QueryApi = {
  findOne: (params: Record<string, unknown>) => Promise<unknown | null>;
  findMany: (params: Record<string, unknown>) => Promise<unknown[]>;
};

export type EggProductionStrapi = {
  documents: (uid: string) => unknown;
  db: {
    query: (uid: string) => QueryApi;
    transaction: <T>(callback: () => Promise<T>) => Promise<T>;
  };
  requestContext: {
    get: () => { state?: Record<string, unknown> } | undefined;
  };
};

export type EggEntryRequestBody = {
  date?: unknown;
  productions?: unknown;
  distributions?: unknown;
  conflictChoice?: unknown;
  conflictChoices?: unknown;
  publish?: unknown;
};

export type EggEntryRequest = {
  userId: number | string | null | undefined;
  body: EggEntryRequestBody;
  dryRun: boolean;
};

export type EggLegStatus =
  'planned' | 'conflict' | 'created' | 'updated' | 'skipped';

export type EggLegResult = {
  key: string;
  kind: ResolvedEggLeg['kind'];
  group: ResolvedEggLeg['group'];
  groupKey: string;
  label: string;
  action: EggLegAction;
  status: EggLegStatus;
  published: boolean;
  documentId: string | null;
  existingDocumentId: string | null;
  existingAmount: number | null;
  relatedLegKey: string | null;
  relatedDocumentId: string | null;
  date: string;
  amount: number;
  description: string;
  organizationId: string;
  debitCode: string | null;
  creditCode: string | null;
  currencyCode: string | null;
};

export type EggConflict = {
  key: string;
  groupKey: string;
  group: ResolvedEggLeg['group'];
  label: string;
  kind: ResolvedEggLeg['kind'];
  amount: number;
  existingDocumentId: string;
  existingAmount: number;
};

export type EggEntryResponse = {
  dryRun: boolean;
  date: string;
  autoPublish: boolean;
  anchorDocumentId: string | null;
  legs: EggLegResult[];
  conflicts: EggConflict[];
  warnings: EggPlanWarning[];
};

function fail(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): TransactionWorkflowError {
  return new TransactionWorkflowError(message, status, code, details);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function documentIdOf(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (isRecord(value) && typeof value.documentId === 'string') {
    return value.documentId.trim() || null;
  }
  return null;
}

// --- Input -----------------------------------------------------------------

type ParsedRequest = {
  date: string;
  productions: { organizationId: string; quantity: number }[];
  distributions: { memberId: string; quantity: number }[];
  conflictChoice: EggConflictChoice | null;
  conflictChoices: Record<string, EggConflictChoice>;
  publish: boolean;
};

function parseConflictChoice(
  value: unknown,
  field: string,
): EggConflictChoice | null {
  if (value === undefined || value === null || value === '') return null;
  if (
    typeof value === 'string' &&
    (EGG_CONFLICT_CHOICES as readonly string[]).includes(value)
  ) {
    return value as EggConflictChoice;
  }
  throw fail(
    400,
    EGG_ERROR.validation,
    `Érvénytelen ütközés kezelés (${field}): skip, replace vagy add lehet`,
    { field },
  );
}

function parseQuantityRows<K extends string>(
  value: unknown,
  idField: K,
  label: string,
): ({ quantity: number } & Record<K, string>)[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw fail(400, EGG_ERROR.validation, `A(z) ${label} lista hibás`, {
      field: label,
    });
  }
  const seen = new Set<string>();
  const rows: ({ quantity: number } & Record<K, string>)[] = [];
  value.forEach((raw, index) => {
    const id = isRecord(raw) ? documentIdOf(raw[idField]) : null;
    const quantity = isRecord(raw) ? Number(raw.quantity) : Number.NaN;
    if (!id) {
      throw fail(
        400,
        EGG_ERROR.validation,
        `Hiányzó azonosító: ${label}[${index}]`,
        {
          field: `${label}[${index}].${idField}`,
        },
      );
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw fail(
        400,
        EGG_ERROR.validation,
        `A darabszám pozitív egész szám kell legyen (${label}[${index}])`,
        { field: `${label}[${index}].quantity` },
      );
    }
    if (seen.has(id)) {
      throw fail(
        400,
        EGG_ERROR.validation,
        `Ismétlődő sor: ${label}[${index}]`,
        {
          field: `${label}[${index}].${idField}`,
        },
      );
    }
    seen.add(id);
    rows.push({ [idField]: id, quantity } as { quantity: number } & Record<
      K,
      string
    >);
  });
  return rows;
}

export function parseEggEntryRequest(body: EggEntryRequestBody): ParsedRequest {
  const rawDate = typeof body.date === 'string' ? body.date.trim() : '';
  const match = /^(\d{4}-\d{2}-\d{2})$/.exec(rawDate.slice(0, 10));
  const date = match?.[1] ?? '';
  if (!date || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
    throw fail(400, EGG_ERROR.validation, 'Érvénytelen vagy hiányzó dátum', {
      field: 'date',
    });
  }
  const productions = parseQuantityRows(
    body.productions,
    'organizationId',
    'productions',
  );
  const distributions = parseQuantityRows(
    body.distributions,
    'memberId',
    'distributions',
  );
  if (productions.length === 0 && distributions.length === 0) {
    throw fail(
      400,
      EGG_ERROR.validation,
      'Adj meg legalább egy nem nulla darabszámot.',
      { field: 'productions' },
    );
  }
  const conflictChoices: Record<string, EggConflictChoice> = {};
  if (body.conflictChoices !== undefined && body.conflictChoices !== null) {
    if (!isRecord(body.conflictChoices)) {
      throw fail(
        400,
        EGG_ERROR.validation,
        'A conflictChoices objektum hibás',
        {
          field: 'conflictChoices',
        },
      );
    }
    for (const [key, value] of Object.entries(body.conflictChoices)) {
      const choice = parseConflictChoice(value, `conflictChoices.${key}`);
      if (choice) conflictChoices[key] = choice;
    }
  }
  return {
    date,
    productions,
    distributions,
    conflictChoice: parseConflictChoice(body.conflictChoice, 'conflictChoice'),
    conflictChoices,
    publish: body.publish === true || body.publish === 'true',
  };
}

// --- Feature / actor -------------------------------------------------------

type EggFeature = {
  row: BackofficeFeatureRow;
  saleCurrencyCode: string;
  autoPublishAllowed: boolean;
  roles: string[];
};

function configString(config: Record<string, unknown> | null, field: string) {
  const value = config?.[field];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function eggFeatureFromRows(
  rows: readonly BackofficeFeatureRow[],
): EggFeature | null {
  const row = rows.find((item) => item.key === EGG_PRODUCTION_FEATURE_KEY);
  if (!row || !row.enabled) return null;
  const appSale = rows.find(
    (item) => item.key === BACKOFFICE_SETTING_KEYS.eggSaleCurrency,
  );
  const saleCurrencyCode =
    configString(row.config, 'saleCurrency') ??
    configString(row.config, 'eggSaleCurrency') ??
    configString(appSale?.config ?? null, 'value') ??
    DEFAULT_EGG_SALE_CURRENCY;
  const initial = configString(row.config, 'initialPublicationStatus');
  const configured = rolesFromFeatureConfig(row.config);
  return {
    row,
    saleCurrencyCode,
    autoPublishAllowed: initial?.toLowerCase() === 'published',
    roles:
      configured.length > 0 ? configured : [...EGG_PRODUCTION_DEFAULT_ROLES],
  };
}

type Actor = {
  roleType: string;
  organizations: { documentId: string; name: string }[];
};

async function loadActor(
  strapi: EggProductionStrapi,
  userId: number | string | null | undefined,
): Promise<Actor> {
  if (userId === null || userId === undefined || userId === '') {
    throw fail(401, EGG_ERROR.unauthenticated, 'Bejelentkezés szükséges');
  }
  const user = (await strapi.db.query(USER_UID).findOne({
    where: { id: userId },
    populate: { role: true, organizations: true },
  })) as {
    role?: { type?: string | null } | null;
    organizations?: { documentId?: string; name?: string | null }[] | null;
  } | null;
  if (!user) {
    throw fail(401, EGG_ERROR.unauthenticated, 'Bejelentkezés szükséges');
  }
  return {
    roleType: typeof user.role?.type === 'string' ? user.role.type : '',
    organizations: (user.organizations ?? [])
      .filter(
        (org): org is { documentId: string; name?: string | null } =>
          typeof org?.documentId === 'string',
      )
      .map((org) => ({ documentId: org.documentId, name: org.name ?? '' })),
  };
}

/** Org ids the actor may book on; `null` = unrestricted (controller). */
export function actorAllowedOrganizationIds(actor: Actor): Set<string> | null {
  if (ORG_SCOPE_BYPASS_CONTENT_ROLE_TYPES.has(actor.roleType)) return null;
  if (ORG_SCOPE_CONTENT_ROLE_TYPES.has(actor.roleType)) {
    return new Set(actor.organizations.map((org) => org.documentId));
  }
  return new Set();
}

function assertOrgScope(
  allowed: Set<string> | null,
  organizations: readonly { documentId: string; name: string }[],
): void {
  if (!allowed) return;
  const denied = organizations.filter((org) => !allowed.has(org.documentId));
  if (denied.length === 0) return;
  const names = [...new Set(denied.map((org) => org.name || org.documentId))];
  throw fail(
    403,
    EGG_ERROR.orgScopeDenied,
    `Nincs jogosultságod ezekre a szervezetekre: ${names.join(', ')}`,
    { organizations: names },
  );
}

// --- Master data -----------------------------------------------------------

type OrgRow = { documentId: string; name: string };

async function findOrganizationByName(
  strapi: EggProductionStrapi,
  name: string,
): Promise<OrgRow | null> {
  const row = (await strapi.db.query(ORGANIZATION_UID).findOne({
    where: { name },
  })) as { documentId?: string; name?: string } | null;
  return row?.documentId
    ? { documentId: row.documentId, name: row.name ?? name }
    : null;
}

async function findChildOrganizations(
  strapi: EggProductionStrapi,
  parentDocumentId: string,
): Promise<OrgRow[]> {
  const rows = (await strapi.db.query(ORGANIZATION_UID).findMany({
    where: { parent: { documentId: parentDocumentId } },
    orderBy: { name: 'asc' },
  })) as { documentId?: string; name?: string | null }[];
  return rows
    .filter((row) => typeof row.documentId === 'string' && row.name)
    .map((row) => ({
      documentId: row.documentId as string,
      name: row.name as string,
    }));
}

async function findCurrency(
  strapi: EggProductionStrapi,
  code: string,
): Promise<CurrencyRef> {
  const row = (await strapi.db.query(CURRENCY_TYPE_UID).findOne({
    where: { code },
  })) as { documentId?: string; code?: string } | null;
  if (!row?.documentId) {
    throw fail(422, EGG_ERROR.masterDataMissing, `Hiányzó pénznem: ${code}`, {
      currency: code,
    });
  }
  return { documentId: row.documentId, code: row.code ?? code };
}

const accountFields = ['documentId', 'code', 'name'];
const stepSharedPopulate = {
  currency_type: { fields: ['documentId', 'code'] },
  transaction_type: { fields: ['documentId'] },
  organization: { fields: ['documentId'] },
};
const templatePopulate = {
  step: {
    on: {
      'workflow.step': {
        populate: {
          ...stepSharedPopulate,
          debit_account: { fields: accountFields },
          credit_account: { fields: accountFields },
        },
      },
      'workflow.step-member-debit': {
        populate: {
          ...stepSharedPopulate,
          credit_account: { fields: accountFields },
        },
      },
      'workflow.step-member-credit': {
        populate: {
          ...stepSharedPopulate,
          debit_account: { fields: accountFields },
        },
      },
    },
  },
};

/**
 * Dedicated templates by name. Seeded as drafts (Convert / catalog read
 * published only); the draft version is always present, so read that.
 */
export async function loadEggTemplates(
  strapi: EggProductionStrapi,
  roles: readonly EggWorkflowTemplateRole[],
): Promise<Partial<EggPlanTemplates>> {
  const names = roles.map((role) => EGG_WORKFLOW_TEMPLATE_NAMES[role]);
  const api = strapi.documents(WORKFLOW_UID) as DocumentsApi;
  const rows = (await api.findMany({
    status: 'draft',
    filters: { name: { $in: names } },
    populate: templatePopulate,
  })) as WorkflowTemplate[];
  const out: Partial<EggPlanTemplates> = {};
  for (const role of roles) {
    const template = rows.find(
      (row) => row?.name === EGG_WORKFLOW_TEMPLATE_NAMES[role],
    );
    if (!template) {
      throw fail(
        422,
        EGG_ERROR.templateMissing,
        `Hiányzó workflow sablon: „${EGG_WORKFLOW_TEMPLATE_NAMES[role]}”. Futtasd a transaction-workflow seedert.`,
        { template: EGG_WORKFLOW_TEMPLATE_NAMES[role] },
      );
    }
    out[role] = template;
  }
  return out;
}

type MembershipRow = {
  documentId?: string;
  name?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  rules?: unknown;
  membership_type?: { name?: string | null; rules?: unknown } | null;
  members?:
    | {
        documentId?: string;
        name?: string | null;
        account?: AccountRef | null;
        private_account?: AccountRef | null;
      }[]
    | null;
};

/** Members of the poultry org valid on `date`; first membership (by name) wins. */
async function loadDistributionMembers(
  strapi: EggProductionStrapi,
  organizationDocumentId: string,
  date: string,
): Promise<Map<string, Omit<EggDistributionInput, 'quantity'>>> {
  const rows = (await strapi.db.query(MEMBERSHIP_UID).findMany({
    where: { organization: { documentId: organizationDocumentId } },
    orderBy: { name: 'asc' },
    populate: {
      members: {
        populate: {
          account: { select: ['documentId', 'code'] },
          private_account: { select: ['documentId', 'code'] },
        },
      },
      membership_type: { select: ['name', 'rules'] },
    },
  })) as MembershipRow[];
  const out = new Map<string, Omit<EggDistributionInput, 'quantity'>>();
  for (const row of rows) {
    if (!membershipValidOnDate(row.valid_from, row.valid_to, date)) continue;
    for (const member of row.members ?? []) {
      if (!member?.documentId || !member.name || out.has(member.documentId)) {
        continue;
      }
      out.set(member.documentId, {
        memberId: member.documentId,
        memberName: member.name,
        rule: resolveEggRule(
          row.rules,
          row.membership_type?.rules,
          row.membership_type?.name ?? null,
        ),
        account: member.account ?? null,
        privateAccount: member.private_account ?? null,
        membershipDocumentId: row.documentId ?? null,
        membershipName: row.name ?? row.membership_type?.name ?? null,
      });
    }
  }
  return out;
}

type TransactionRow = {
  documentId?: string;
  amount?: number | string | null;
  date?: string | null;
  publishedAt?: string | null;
  organization?: { documentId?: string } | null;
  currency_type?: { documentId?: string } | null;
  debit_account?: { documentId?: string } | null;
  credit_account?: { documentId?: string } | null;
};

/** Draft and published rows on the day for these orgs (published amount wins). */
async function loadExistingTransactions(
  strapi: EggProductionStrapi,
  date: string,
  organizationIds: readonly string[],
): Promise<ExistingEggTransaction[]> {
  if (organizationIds.length === 0) return [];
  const rows = (await strapi.db.query(TRANSACTION_UID).findMany({
    where: {
      date,
      organization: { documentId: { $in: [...organizationIds] } },
    },
    populate: {
      organization: { select: ['documentId'] },
      currency_type: { select: ['documentId'] },
      debit_account: { select: ['documentId'] },
      credit_account: { select: ['documentId'] },
    },
  })) as TransactionRow[];
  const byId = new Map<string, ExistingEggTransaction>();
  const ordered = [...rows].sort(
    (a, b) => Number(Boolean(a.publishedAt)) - Number(Boolean(b.publishedAt)),
  );
  for (const row of ordered) {
    const amount = Number(row.amount);
    const documentId = row.documentId;
    const organizationId = row.organization?.documentId;
    const currencyTypeId = row.currency_type?.documentId;
    const debitAccountId = row.debit_account?.documentId;
    const creditAccountId = row.credit_account?.documentId;
    if (
      !documentId ||
      !Number.isFinite(amount) ||
      !organizationId ||
      !currencyTypeId ||
      !debitAccountId ||
      !creditAccountId
    ) {
      continue;
    }
    byId.set(documentId, {
      documentId,
      amount,
      date: String(row.date ?? date).slice(0, 10),
      organizationId,
      currencyTypeId,
      debitAccountId,
      creditAccountId,
    });
  }
  return [...byId.values()];
}

// --- Response helpers ------------------------------------------------------

function legResult(
  leg: ResolvedEggLeg,
  status: EggLegStatus,
  extra?: {
    documentId?: string | null;
    relatedDocumentId?: string | null;
    published?: boolean;
  },
): EggLegResult {
  return {
    key: leg.key,
    kind: leg.kind,
    group: leg.group,
    groupKey: leg.groupKey,
    label: leg.label,
    action: leg.action,
    status,
    published: extra?.published ?? false,
    documentId: extra?.documentId ?? null,
    existingDocumentId: leg.existing?.documentId ?? null,
    existingAmount: leg.existing?.amount ?? null,
    relatedLegKey: leg.relatedLegKey,
    relatedDocumentId: extra?.relatedDocumentId ?? null,
    date: leg.data.date,
    amount: leg.data.amount,
    description: leg.data.description,
    organizationId: leg.data.organization,
    debitCode: leg.codes.debit,
    creditCode: leg.codes.credit,
    currencyCode: leg.codes.currency,
  };
}

export function conflictsOf(legs: readonly ResolvedEggLeg[]): EggConflict[] {
  return legs
    .filter((leg) => leg.existing)
    .map((leg) => ({
      key: leg.key,
      groupKey: leg.groupKey,
      group: leg.group,
      label: leg.label,
      kind: leg.kind,
      amount: leg.data.amount,
      existingDocumentId: leg.existing!.documentId,
      existingAmount: leg.existing!.amount,
    }));
}

function errorStatus(error: unknown): number | null {
  if (error instanceof TransactionWorkflowError) return error.status;
  if (isRecord(error)) {
    const name = error.name;
    if (name === 'ForbiddenError' || name === 'PolicyError') return 403;
    if (name === 'ValidationError') return 400;
    if (name === 'NotFoundError') return 404;
  }
  return null;
}

// --- Main ------------------------------------------------------------------

export async function submitEggEntries(
  strapi: EggProductionStrapi,
  request: EggEntryRequest,
): Promise<EggEntryResponse> {
  const parsed = parseEggEntryRequest(request.body ?? {});

  const feature = eggFeatureFromRows(
    await loadBackofficeFeatureRows(
      strapi as unknown as Parameters<typeof loadBackofficeFeatureRows>[0],
    ),
  );
  if (!feature) {
    throw fail(
      403,
      EGG_ERROR.featureDisabled,
      'A napi tojás rögzítés ki van kapcsolva (egg-production beállítás).',
    );
  }

  const actor = await loadActor(strapi, request.userId);
  if (!feature.roles.includes(actor.roleType)) {
    throw fail(
      403,
      EGG_ERROR.roleForbidden,
      'A szerepköröd nem rögzíthet napi tojás termelést.',
      { role: actor.roleType },
    );
  }
  const allowedOrgs = actorAllowedOrganizationIds(actor);

  const poultry = await findOrganizationByName(
    strapi,
    POULTRY_STOCK_ORGANIZATION_NAME,
  );
  if (!poultry) {
    throw fail(
      422,
      EGG_ERROR.masterDataMissing,
      `Hiányzó szervezet: ${POULTRY_STOCK_ORGANIZATION_NAME}`,
    );
  }
  const coops = await findChildOrganizations(strapi, poultry.documentId);
  const coopById = new Map(coops.map((coop) => [coop.documentId, coop]));
  const productions: EggProductionInput[] = parsed.productions.map((row) => {
    const coop = coopById.get(row.organizationId);
    if (!coop) {
      throw fail(
        400,
        EGG_ERROR.validation,
        `Ismeretlen tyúkól (nem a(z) ${POULTRY_STOCK_ORGANIZATION_NAME} alatt van)`,
        { organizationId: row.organizationId },
      );
    }
    return {
      organizationId: coop.documentId,
      organizationName: coop.name,
      quantity: row.quantity,
    };
  });
  // Fail early on the coops the user typed in; leg orgs are checked again below.
  assertOrgScope(
    allowedOrgs,
    productions.map((row) => ({
      documentId: row.organizationId,
      name: row.organizationName,
    })),
  );

  const eggCurrency = await findCurrency(strapi, EGG_CURRENCY_CODE);
  const saleCurrency = await findCurrency(strapi, feature.saleCurrencyCode);

  let distributions: EggDistributionInput[] = [];
  if (parsed.distributions.length > 0) {
    const members = await loadDistributionMembers(
      strapi,
      poultry.documentId,
      parsed.date,
    );
    distributions = parsed.distributions.map((row) => {
      const member = members.get(row.memberId);
      if (!member) {
        throw fail(
          400,
          EGG_ERROR.validation,
          `Ismeretlen vagy a napon nem érvényes tag a(z) ${POULTRY_STOCK_ORGANIZATION_NAME} szervezetben`,
          { memberId: row.memberId },
        );
      }
      return { ...member, quantity: row.quantity };
    });
  }

  const templateRoles: EggWorkflowTemplateRole[] = ['productionPool'];
  if (distributions.length > 0) {
    templateRoles.push('distributionInternal', 'distributionSale');
  }
  const loaded = await loadEggTemplates(strapi, templateRoles);
  const templates = {
    productionPool: loaded.productionPool!,
    distributionInternal: loaded.distributionInternal ?? loaded.productionPool!,
    distributionSale: loaded.distributionSale ?? loaded.productionPool!,
  } satisfies EggPlanTemplates;

  let saleRate: AppliedRate | null = null;
  if (distributions.some((row) => row.rule.mode === 'sale')) {
    const resolveRate = createRateResolver(
      strapi as unknown as Pick<ConvertContextStrapi, 'documents'>,
    );
    saleRate = await resolveRate(
      eggCurrency.documentId,
      saleCurrency.documentId,
      parsed.date,
      { fromCode: eggCurrency.code, toCode: saleCurrency.code },
    );
  }

  const plan = buildEggEntryPlan({
    date: parsed.date,
    productions,
    distributions,
    templates,
    eggCurrency,
    saleCurrency,
    saleRate,
  });

  const legOrgIds = [...new Set(plan.legs.map((leg) => leg.data.organization))];
  const orgNameById = new Map<string, string>([
    [poultry.documentId, poultry.name],
    ...coops.map((coop) => [coop.documentId, coop.name] as [string, string]),
  ]);
  assertOrgScope(
    allowedOrgs,
    legOrgIds.map((id) => ({
      documentId: id,
      name: orgNameById.get(id) ?? id,
    })),
  );

  const existing = await loadExistingTransactions(
    strapi,
    parsed.date,
    legOrgIds,
  );
  const resolved = resolveEggLegActions(
    plan.legs,
    matchEggDuplicates(plan.legs, existing),
    parsed.conflictChoice,
    parsed.conflictChoices,
  );
  const conflicts = conflictsOf(resolved);
  const warnings = [...plan.warnings];
  const autoPublish = parsed.publish && feature.autoPublishAllowed;

  if (request.dryRun) {
    return {
      dryRun: true,
      date: parsed.date,
      autoPublish,
      anchorDocumentId: null,
      legs: resolved.map((leg) =>
        legResult(leg, leg.action === 'conflict' ? 'conflict' : 'planned'),
      ),
      conflicts,
      warnings,
    };
  }

  if (resolved.some((leg) => leg.action === 'conflict')) {
    throw fail(
      409,
      EGG_ERROR.conflictChoiceRequired,
      'Már van rögzítés erre a napra. Válaszd ki, mit tegyünk a meglévő sorokkal.',
      { conflicts },
    );
  }

  const results = await writeLegs(strapi, resolved, autoPublish);
  const firstProduction = results.find((leg) => leg.kind === 'production');
  return {
    dryRun: false,
    date: parsed.date,
    autoPublish,
    anchorDocumentId: firstProduction?.documentId ?? null,
    legs: results,
    conflicts,
    warnings,
  };
}

/** All legs in one DB transaction: any failure rolls back every write. */
async function writeLegs(
  strapi: EggProductionStrapi,
  legs: readonly ResolvedEggLeg[],
  autoPublish: boolean,
): Promise<EggLegResult[]> {
  const transactions = strapi.documents(TRANSACTION_UID) as DocumentsApi;
  let current: ResolvedEggLeg | null = null;
  try {
    return await strapi.db.transaction(async () => {
      const documentIdByLegKey = new Map<string, string>();
      const out: EggLegResult[] = [];
      for (const leg of legs) {
        current = leg;
        const relatedDocumentId = leg.relatedLegKey
          ? (documentIdByLegKey.get(leg.relatedLegKey) ?? null)
          : null;
        if (leg.action === 'skip' && leg.existing) {
          documentIdByLegKey.set(leg.key, leg.existing.documentId);
          out.push(
            legResult(leg, 'skipped', {
              documentId: leg.existing.documentId,
            }),
          );
          continue;
        }
        const data: Record<string, unknown> = { ...leg.data };
        if (relatedDocumentId) data.related_transaction = relatedDocumentId;
        let documentId: string | null;
        let status: EggLegStatus;
        if (leg.action === 'update' && leg.existing) {
          await transactions.update({
            documentId: leg.existing.documentId,
            data,
          });
          documentId = leg.existing.documentId;
          status = 'updated';
        } else {
          const created = await transactions.create({ data });
          documentId = documentIdOf(created);
          status = 'created';
        }
        if (!documentId) {
          throw new Error('Transaction write returned no documentId');
        }
        documentIdByLegKey.set(leg.key, documentId);
        if (autoPublish) {
          const id = documentId;
          await withPublishGuardLinked(
            strapi as unknown as Parameters<typeof withPublishGuardLinked>[0],
            () => transactions.publish({ documentId: id }),
            { eggWorkflowAuto: true },
          );
        }
        out.push(
          legResult(leg, status, {
            documentId,
            relatedDocumentId,
            published: autoPublish,
          }),
        );
      }
      return out;
    });
  } catch (error) {
    const failed = current as ResolvedEggLeg | null;
    const message = error instanceof Error ? error.message : String(error);
    throw fail(
      errorStatus(error) ?? 500,
      error instanceof TransactionWorkflowError && error.code
        ? error.code
        : EGG_ERROR.writeFailed,
      `A mentés nem sikerült, semmi nem került rögzítésre${
        failed ? ` (${failed.label})` : ''
      }: ${message}`,
      {
        legKey: failed?.key ?? null,
        groupKey: failed?.groupKey ?? null,
        label: failed?.label ?? null,
      },
    );
  }
}
