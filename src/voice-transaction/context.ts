import type { BackofficeFeatureRow } from '../backoffice-features/types';
import {
  ORG_SCOPE_BYPASS_CONTENT_ROLE_TYPES,
  ORG_SCOPE_CONTENT_ROLE_TYPES,
} from '../org-scope-middleware';
import type {
  VoiceActor,
  VoiceContextAccount,
  VoiceContextCurrency,
  VoiceContextMember,
  VoiceContextOrganization,
  VoiceContextWorkflow,
  VoiceParseContext,
} from './types';

const USER_UID = 'plugin::users-permissions.user';
const ORGANIZATION_UID = 'api::organization.organization';
const ACCOUNT_UID = 'api::account.account';
const CURRENCY_TYPE_UID = 'api::currency-type.currency-type';
const MEMBER_UID = 'api::member.member';
const WORKFLOW_UID = 'api::transaction-workflow.transaction-workflow';

/** Upper bound per list so the prompt stays bounded. */
const CONTEXT_LIST_LIMIT = 1500;

type Row = Record<string, unknown>;

export type VoiceContextStrapi = {
  db: {
    query: (uid: string) => {
      findOne: (params: Record<string, unknown>) => Promise<Row | null>;
      findMany: (params: Record<string, unknown>) => Promise<Row[]>;
    };
  };
};

function str(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function documentIdOf(row: unknown): string {
  return row && typeof row === 'object'
    ? str((row as { documentId?: unknown }).documentId)
    : '';
}

/** Organizations the actor may book to: controller → all, dataentry/editor → own memberships. */
export async function loadAccessibleOrganizations(
  strapi: VoiceContextStrapi,
  actor: VoiceActor,
): Promise<VoiceContextOrganization[]> {
  const orgQuery = strapi.db.query(ORGANIZATION_UID);
  let rows: Row[];
  if (ORG_SCOPE_BYPASS_CONTENT_ROLE_TYPES.has(actor.roleType)) {
    rows = await orgQuery.findMany({
      select: ['documentId', 'name'],
      orderBy: { name: 'asc' },
      limit: CONTEXT_LIST_LIMIT,
    });
  } else if (ORG_SCOPE_CONTENT_ROLE_TYPES.has(actor.roleType)) {
    const user = await strapi.db.query(USER_UID).findOne({
      where: { id: actor.userId },
      populate: { organizations: { select: ['documentId', 'name'] } },
    });
    const orgs = user?.organizations;
    rows = Array.isArray(orgs) ? (orgs as Row[]) : [];
  } else {
    rows = [];
  }
  const seen = new Set<string>();
  const result: VoiceContextOrganization[] = [];
  for (const row of rows) {
    const id = documentIdOf(row);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, name: str(row.name) });
  }
  return result;
}

/** Published workflow templates; a template whose `configuration.feature` names a disabled feature row is hidden. */
export function workflowEnabledByFeatures(
  configuration: unknown,
  features: readonly BackofficeFeatureRow[],
): boolean {
  if (!configuration || typeof configuration !== 'object') return true;
  const feature = str((configuration as { feature?: unknown }).feature);
  if (!feature) return true;
  const row = features.find((r) => r.key === feature);
  return row?.enabled === true;
}

export async function loadVoiceParseContext(
  strapi: VoiceContextStrapi,
  params: {
    actor: VoiceActor;
    features: readonly BackofficeFeatureRow[];
    selectedOrganizationId: string | null;
    today: string;
  },
): Promise<VoiceParseContext> {
  const [organizations, accountRows, currencyRows, memberRows, workflowRows] =
    await Promise.all([
      loadAccessibleOrganizations(strapi, params.actor),
      strapi.db.query(ACCOUNT_UID).findMany({
        select: ['documentId', 'code', 'name'],
        orderBy: { code: 'asc' },
        limit: CONTEXT_LIST_LIMIT,
      }),
      strapi.db.query(CURRENCY_TYPE_UID).findMany({
        select: ['documentId', 'code', 'name'],
        orderBy: { code: 'asc' },
        limit: CONTEXT_LIST_LIMIT,
      }),
      strapi.db.query(MEMBER_UID).findMany({
        select: ['documentId', 'name', 'identifier'],
        orderBy: { name: 'asc' },
        limit: CONTEXT_LIST_LIMIT,
      }),
      strapi.db.query(WORKFLOW_UID).findMany({
        where: { publishedAt: { $notNull: true } },
        select: [
          'documentId',
          'name',
          'debit_account_code',
          'credit_account_code',
          'configuration',
        ],
        populate: { currency_type: { select: ['code'] } },
        orderBy: { name: 'asc' },
        limit: CONTEXT_LIST_LIMIT,
      }),
    ]);

  const accounts: VoiceContextAccount[] = accountRows
    .map((row) => ({
      id: documentIdOf(row),
      code: str(row.code),
      name: str(row.name),
    }))
    .filter((row) => row.id);
  const currencyTypes: VoiceContextCurrency[] = currencyRows
    .map((row) => ({
      id: documentIdOf(row),
      code: str(row.code),
      name: str(row.name),
    }))
    .filter((row) => row.id);
  const members: VoiceContextMember[] = memberRows
    .map((row) => ({
      id: documentIdOf(row),
      name: str(row.name),
      identifier: str(row.identifier),
    }))
    .filter((row) => row.id);
  const workflows: VoiceContextWorkflow[] = workflowRows
    .filter((row) =>
      workflowEnabledByFeatures(row.configuration, params.features),
    )
    .map((row) => {
      const currency = row.currency_type as { code?: unknown } | null;
      return {
        id: documentIdOf(row),
        name: str(row.name),
        debit_account_code: str(row.debit_account_code),
        credit_account_code: str(row.credit_account_code),
        currency_code: currency ? str(currency.code) || null : null,
      };
    })
    .filter((row) => row.id);

  const selected = params.selectedOrganizationId;
  return {
    today: params.today,
    organizations,
    accounts,
    currencyTypes,
    members,
    workflows,
    selectedOrganizationId:
      selected && organizations.some((o) => o.id === selected)
        ? selected
        : null,
  };
}
