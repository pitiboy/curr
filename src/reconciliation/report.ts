import { readAuditConfig } from '../audit/config';
import { loadBackofficeFeatureRows } from '../backoffice-features/load';
import { MEMBER_ACCOUNT_KINDS } from '../member-accounts';
import { contentApiActor, type PublishGuardStrapi } from '../publish-guard';
import { assertReconciliationController } from './auth';
import { defaultConvertedTransactionWhere } from './converted-filter';
import { ReconciliationError } from './errors';
import {
  normalizePublishedWithoutReceiptsAccountFilter,
  publishedWithoutReceiptsFilterFromConfig,
  transactionMatchesPublishedWithoutReceiptsFilter,
  type PublishedWithoutReceiptsAccountFilter,
} from './published-without-receipts-filter';
import {
  CONTENT_USER_ROLE_TYPES,
  RECONCILIATION_ITEM_CAP,
  type ReconciliationItem,
  type ReconciliationReport,
  type ReconciliationSection,
} from './types';

const RECONCILIATION_FEATURE_KEY = 'reconciliation';

const TRANSACTION_UID = 'api::transaction.transaction';
const RECEIPT_UID = 'api::receipt.receipt';
const MEMBER_UID = 'api::member.member';
const MEMBERSHIP_UID = 'api::membership.membership';
const ACCOUNT_UID = 'api::account.account';
const USER_UID = 'plugin::users-permissions.user';
const AUDIT_LOG_UID = 'api::audit-log.audit-log';

const MEMBER_LEDGER_ACCOUNT_CODES = ['1101', '1001'] as const;

type DbQuery = {
  findMany: (
    params: Record<string, unknown>,
  ) => Promise<Record<string, unknown>[]>;
};

export type ReconciliationStrapi = Pick<
  PublishGuardStrapi,
  'requestContext'
> & {
  db: { query: (uid: string) => DbQuery };
  documents?: (uid: string) => {
    findMany: (params?: Record<string, unknown>) => Promise<unknown[]>;
  };
};

function capItems<T extends ReconciliationItem>(
  rows: T[],
): { items: T[]; capped: boolean; count: number } {
  const count = rows.length;
  const capped = count > RECONCILIATION_ITEM_CAP;
  return {
    count,
    capped,
    items: capped ? rows.slice(0, RECONCILIATION_ITEM_CAP) : rows,
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asId(value: unknown): number | string | undefined {
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'number' || typeof id === 'string') return id;
  }
  return undefined;
}

function section(
  key: string,
  rows: ReconciliationItem[],
  drilldown?: ReconciliationSection['drilldown'],
): ReconciliationSection {
  const { items, capped, count } = capItems(rows);
  return { key, count, items, capped, drilldown };
}

function loginPathsFromEnv(): string[] {
  const cfg = readAuditConfig(process.env);
  const paths = [...cfg.alwaysPaths].filter(
    (path) =>
      path === '/api/auth/local' ||
      path === '/api/auth/local/register' ||
      path === '/api/auth/google/callback',
  );
  return paths.length > 0
    ? paths
    : ['/api/auth/local', '/api/auth/google/callback'];
}

function inactiveCutoffIso(): string {
  const days = readAuditConfig(process.env).retentionDays;
  const windowDays = Math.min(365, days > 0 ? days : 365);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  return cutoff.toISOString();
}

async function loadDraftTransactions(db: ReconciliationStrapi['db']) {
  return db.query(TRANSACTION_UID).findMany({
    where: {
      publishedAt: { $null: true },
      ...defaultConvertedTransactionWhere(),
    },
    select: ['documentId', 'date', 'amount', 'description', 'entered_by'],
    orderBy: { updatedAt: 'desc' },
  });
}

async function loadPublishedWithoutReceipts(
  db: ReconciliationStrapi['db'],
  accountFilter?: PublishedWithoutReceiptsAccountFilter | null,
) {
  const resolvedFilter =
    normalizePublishedWithoutReceiptsAccountFilter(accountFilter);
  const [published, receipts] = await Promise.all([
    db.query(TRANSACTION_UID).findMany({
      where: {
        publishedAt: { $notNull: true },
        ...defaultConvertedTransactionWhere(),
      },
      select: [
        'id',
        'documentId',
        'date',
        'amount',
        'description',
        'published_by',
      ],
      populate: {
        debit_account: { select: ['code'] },
        credit_account: { select: ['code'] },
        currency_type: { select: ['code'] },
      },
      orderBy: { publishedAt: 'desc' },
    }),
    db.query(RECEIPT_UID).findMany({
      select: ['id'],
      populate: { transaction: { select: ['id'] } },
    }),
  ]);

  const txWithReceipt = new Set<number | string>();
  for (const row of receipts) {
    const txId = asId(row.transaction);
    if (txId != null) txWithReceipt.add(txId);
  }

  return published.filter((row) => {
    const id = row.id;
    if (id != null && txWithReceipt.has(id as number | string)) return false;
    return transactionMatchesPublishedWithoutReceiptsFilter(
      row,
      resolvedFilter,
    );
  });
}

async function loadPublishedWithoutReceiptsAccountFilter(
  strapi: ReconciliationStrapi,
): Promise<PublishedWithoutReceiptsAccountFilter> {
  if (typeof strapi.documents !== 'function') {
    return publishedWithoutReceiptsFilterFromConfig(null);
  }
  const rows = await loadBackofficeFeatureRows(
    strapi as {
      documents: NonNullable<ReconciliationStrapi['documents']>;
    },
  );
  const feature = rows.find((row) => row.key === RECONCILIATION_FEATURE_KEY);
  return normalizePublishedWithoutReceiptsAccountFilter(
    publishedWithoutReceiptsFilterFromConfig(feature?.config),
  );
}

async function loadOrphanReceipts(db: ReconciliationStrapi['db']) {
  return db.query(RECEIPT_UID).findMany({
    where: { transaction: { $null: true } },
    select: ['documentId', 'date', 'amount', 'vendor', 'description'],
    orderBy: { updatedAt: 'desc' },
  });
}

async function loadMembersWithoutMembership(db: ReconciliationStrapi['db']) {
  const members = await db.query(MEMBER_UID).findMany({
    select: ['documentId', 'identifier', 'name', 'email'],
    populate: { memberships: { select: ['id'] } },
    orderBy: { name: 'asc' },
  });
  return members.filter((row) => {
    const memberships = row.memberships;
    return !Array.isArray(memberships) || memberships.length === 0;
  });
}

async function loadMembershipsWithoutMembers(db: ReconciliationStrapi['db']) {
  const rows = await db.query(MEMBERSHIP_UID).findMany({
    select: ['documentId', 'name'],
    populate: {
      members: { select: ['id'] },
      organization: { select: ['name'] },
    },
    orderBy: { name: 'asc' },
  });
  return rows.filter((row) => {
    const members = row.members;
    return !Array.isArray(members) || members.length === 0;
  });
}

async function loadMembersMissingAccounts(db: ReconciliationStrapi['db']) {
  const members = await db.query(MEMBER_UID).findMany({
    select: ['documentId', 'identifier', 'name', 'email'],
    populate: {
      account: { select: ['documentId', 'code'] },
      private_account: { select: ['documentId', 'code'] },
    },
    orderBy: { name: 'asc' },
  });
  const items: ReconciliationItem[] = [];
  for (const member of members) {
    for (const kind of MEMBER_ACCOUNT_KINDS) {
      const linked = member[kind.field];
      const hasLink =
        linked != null &&
        typeof linked === 'object' &&
        asString((linked as { documentId?: unknown }).documentId);
      if (!hasLink) {
        items.push({
          documentId: asString(member.documentId),
          identifier: asString(member.identifier) || asString(member.name),
          email: asString(member.email),
          missingAccount: kind.field,
          expectedCode: kind.code,
        });
      }
    }
  }
  return items;
}

async function loadOrphanMemberAccounts(db: ReconciliationStrapi['db']) {
  const members = await db.query(MEMBER_UID).findMany({
    select: ['id'],
    populate: {
      account: { select: ['id'] },
      private_account: { select: ['id'] },
    },
  });
  const referenced = new Set<number | string>();
  for (const member of members) {
    const accountId = asId(member.account);
    const privateId = asId(member.private_account);
    if (accountId != null) referenced.add(accountId);
    if (privateId != null) referenced.add(privateId);
  }

  const accounts = await db.query(ACCOUNT_UID).findMany({
    where: { code: { $in: [...MEMBER_LEDGER_ACCOUNT_CODES] } },
    select: ['documentId', 'code', 'name'],
    orderBy: { code: 'asc' },
  });

  return accounts.filter((row) => {
    const id = row.id;
    return id != null && !referenced.has(id as number | string);
  });
}

async function loadUsersInvalidRole(db: ReconciliationStrapi['db']) {
  const users = await db.query(USER_UID).findMany({
    select: ['id', 'email', 'username'],
    populate: { role: { select: ['type', 'name'] } },
    orderBy: { email: 'asc' },
  });
  return users.filter((user) => {
    const role = user.role;
    if (!role || typeof role !== 'object') return true;
    const type = asString((role as { type?: unknown }).type);
    return !(CONTENT_USER_ROLE_TYPES as readonly string[]).includes(type);
  });
}

async function loadUsersInactive(db: ReconciliationStrapi['db']) {
  const loginPaths = loginPathsFromEnv();
  const cutoff = inactiveCutoffIso();
  const logins = await db.query(AUDIT_LOG_UID).findMany({
    where: {
      actor_type: 'user',
      occurred_at: { $gte: cutoff },
      path: { $in: loginPaths },
      status: { $gte: 200, $lte: 299 },
    },
    select: ['actor_id'],
  });
  const activeIds = new Set(
    logins.map((row) => asString(row.actor_id)).filter((id) => id.length > 0),
  );

  const users = await db.query(USER_UID).findMany({
    select: ['id', 'email', 'username', 'blocked'],
    populate: { role: { select: ['type', 'name'] } },
    orderBy: { email: 'asc' },
  });

  return users.filter((user) => !activeIds.has(String(user.id ?? '')));
}

function mapTransactionItems(
  rows: Record<string, unknown>[],
): ReconciliationItem[] {
  return rows.map((row) => ({
    documentId: asString(row.documentId),
    date: asString(row.date),
    amount: row.amount as string | number | null | undefined,
    description: asString(row.description),
    enteredBy: asString(row.entered_by),
    publishedBy: asString(row.published_by),
  }));
}

function mapReceiptItems(
  rows: Record<string, unknown>[],
): ReconciliationItem[] {
  return rows.map((row) => ({
    documentId: asString(row.documentId),
    date: asString(row.date),
    amount: row.amount as string | number | null | undefined,
    vendor: asString(row.vendor),
    description: asString(row.description),
  }));
}

function mapMemberItems(rows: Record<string, unknown>[]): ReconciliationItem[] {
  return rows.map((row) => ({
    documentId: asString(row.documentId),
    identifier: asString(row.identifier) || asString(row.name),
    name: asString(row.name),
    email: asString(row.email),
  }));
}

function mapMembershipItems(
  rows: Record<string, unknown>[],
): ReconciliationItem[] {
  return rows.map((row) => ({
    documentId: asString(row.documentId),
    name: asString(row.name),
    organization: asString(
      row.organization &&
        typeof row.organization === 'object' &&
        'name' in row.organization
        ? (row.organization as { name?: unknown }).name
        : '',
    ),
  }));
}

function mapAccountItems(
  rows: Record<string, unknown>[],
): ReconciliationItem[] {
  return rows.map((row) => ({
    documentId: asString(row.documentId),
    code: asString(row.code),
    name: asString(row.name),
  }));
}

function mapUserItems(rows: Record<string, unknown>[]): ReconciliationItem[] {
  return rows.map((row) => {
    const role = row.role;
    const roleType =
      role && typeof role === 'object' && 'type' in role
        ? asString((role as { type?: unknown }).type)
        : '';
    const roleName =
      role && typeof role === 'object' && 'name' in role
        ? asString((role as { name?: unknown }).name)
        : '';
    return {
      id: row.id as number | string | undefined,
      email: asString(row.email),
      username: asString(row.username),
      roleType: roleType || null,
      roleName: roleName || null,
      blocked: row.blocked === true,
    };
  });
}

export async function buildReconciliationReport(
  strapi: ReconciliationStrapi,
): Promise<ReconciliationReport> {
  const accountFilter = await loadPublishedWithoutReceiptsAccountFilter(strapi);
  const [
    draftRows,
    publishedNoReceiptRows,
    orphanReceiptRows,
    membersNoMembership,
    membershipsNoMembers,
    membersMissingAccounts,
    orphanAccounts,
    invalidRoleUsers,
    inactiveUsers,
  ] = await Promise.all([
    loadDraftTransactions(strapi.db),
    loadPublishedWithoutReceipts(strapi.db, accountFilter),
    loadOrphanReceipts(strapi.db),
    loadMembersWithoutMembership(strapi.db),
    loadMembershipsWithoutMembers(strapi.db),
    loadMembersMissingAccounts(strapi.db),
    loadOrphanMemberAccounts(strapi.db),
    loadUsersInvalidRole(strapi.db),
    loadUsersInactive(strapi.db),
  ]);

  const auditLogRetentionDays = readAuditConfig(process.env).retentionDays;

  return {
    generatedAt: new Date().toISOString(),
    auditLogRetentionDays,
    sections: [
      section(
        'draftTransactions',
        mapTransactionItems(draftRows),
        'draftTransactions',
      ),
      section('orphanReceipts', mapReceiptItems(orphanReceiptRows)),
      section(
        'publishedWithoutReceipts',
        mapTransactionItems(publishedNoReceiptRows),
        'publishedWithoutReceipts',
      ),
      section('membersWithoutMembership', mapMemberItems(membersNoMembership)),
      section(
        'membershipsWithoutMembers',
        mapMembershipItems(membershipsNoMembers),
      ),
      section('membersMissingLedgerAccounts', membersMissingAccounts),
      section('orphanMemberAccounts', mapAccountItems(orphanAccounts)),
      section('usersInvalidRole', mapUserItems(invalidRoleUsers)),
      section('usersInactive', mapUserItems(inactiveUsers)),
    ],
  };
}

export async function reconciliationForRequest(
  strapi: ReconciliationStrapi,
): Promise<ReconciliationReport> {
  await assertReconciliationController(strapi);
  return buildReconciliationReport(strapi);
}
