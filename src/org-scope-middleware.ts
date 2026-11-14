import { errors } from '@strapi/utils';

import {
  contentApiActor,
  relationDocumentId,
  type PublishGuardStrapi,
} from './publish-guard';

const TRANSACTION_UID = 'api::transaction.transaction';
const RECEIPT_UID = 'api::receipt.receipt';
const ORGANIZATION_UID = 'api::organization.organization';

/**
 * Content types whose primary org dimension is `organization` (transactions for
 * termelés / átvezetés / osztás / eladás flows and related reads). Receipts are
 * scoped via their linked transactions (`transactions.organization`).
 *
 * `transaction-workflow` is not listed: it has no organization field; workflow
 * templates stay globally readable for convert.
 */
export const ORG_SCOPED_DOCUMENT_UIDS = [
  TRANSACTION_UID,
  RECEIPT_UID,
  ORGANIZATION_UID,
] as const;

export const ORG_SCOPED_DOCUMENT_UID_SET = new Set<string>(
  ORG_SCOPED_DOCUMENT_UIDS,
);

/**
 * Content API roles that are constrained to {@link ORG_SCOPED_DOCUMENT_UIDS}
 * when the request is authenticated as users-permissions.
 * Named after `src/index.ts` bootstrap (`dataentry`, `editor`). Other U&P
 * roles pass through unscoped unless we add them here.
 */
export const ORG_SCOPE_CONTENT_ROLE_TYPES = new Set(['dataentry', 'editor']);

/** Controller bypasses org membership checks on every Document Service action. */
export const ORG_SCOPE_BYPASS_CONTENT_ROLE_TYPES = new Set(['controller']);

/** No Document Service org filter for these actions (not passed to db query). */
const ACTIONS_WITHOUT_FILTERS = new Set([
  'updateComponents',
  'omitComponentData',
]);

/** Mutations that look up by documentId and need an explicit access probe (Strapi update fallback query ignores filters). */
const DOCUMENT_LIFECYCLE_ACTIONS = new Set([
  'update',
  'delete',
  'publish',
  'unpublish',
  'discardDraft',
  'clone',
]);

const NONE_PLACEHOLDER = '__org_scope_no_membership__';

type OrgScopeStrapi = Pick<
  PublishGuardStrapi,
  'documents' | 'db' | 'requestContext'
>;

function organizationDocumentIdFilter(
  orgDocumentIds: string[],
): Record<string, unknown> {
  return orgDocumentIds.length > 0
    ? { documentId: { $in: orgDocumentIds } }
    : { documentId: { $eq: NONE_PLACEHOLDER } };
}

function mergeOrgFilter(
  existing: Record<string, unknown> | undefined,
  orgDocumentIds: string[],
): Record<string, unknown> {
  const orgPredicate = organizationDocumentIdFilter(orgDocumentIds);

  if (!existing || Object.keys(existing).length === 0) {
    return { organization: orgPredicate };
  }
  return { $and: [existing, { organization: orgPredicate }] };
}

/** Organization rows are filtered by their own `documentId`, not a nested `organization` field. */
function mergeOrganizationSelfFilter(
  existing: Record<string, unknown> | undefined,
  orgDocumentIds: string[],
): Record<string, unknown> {
  const pred = organizationDocumentIdFilter(orgDocumentIds);
  if (!existing || Object.keys(existing).length === 0) {
    return pred;
  }
  return { $and: [existing, pred] };
}

/** Receipt has no `organization`; scope through the linked transaction. */
function mergeReceiptOrgFilter(
  existing: Record<string, unknown> | undefined,
  orgDocumentIds: string[],
): Record<string, unknown> {
  const pred = organizationDocumentIdFilter(orgDocumentIds);
  const scope = { transactions: { organization: pred } };
  if (!existing || Object.keys(existing).length === 0) {
    return scope;
  }
  return { $and: [existing, scope] };
}

export function mergeScopedFilter(
  uid: string,
  existing: Record<string, unknown> | undefined,
  orgDocumentIds: string[],
): Record<string, unknown> {
  if (uid === ORGANIZATION_UID) {
    return mergeOrganizationSelfFilter(existing, orgDocumentIds);
  }
  if (uid === RECEIPT_UID) {
    return mergeReceiptOrgFilter(existing, orgDocumentIds);
  }
  return mergeOrgFilter(existing, orgDocumentIds);
}

export function shouldApplyOrgScope(params: {
  uid: string;
  action: string;
  strategyName?: string;
  roleType: string | null;
}): boolean {
  if (!ORG_SCOPED_DOCUMENT_UID_SET.has(params.uid)) {
    return false;
  }
  if (ACTIONS_WITHOUT_FILTERS.has(params.action)) {
    return false;
  }
  if (params.strategyName !== 'users-permissions') {
    return false;
  }
  if (
    params.roleType == null ||
    !ORG_SCOPE_CONTENT_ROLE_TYPES.has(params.roleType)
  ) {
    return false;
  }
  return true;
}

export async function loadUserOrgDocumentIds(
  strapi: OrgScopeStrapi,
  userId: number | string,
): Promise<string[]> {
  const row = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    populate: {
      organizations: { fields: ['documentId'] },
    },
  });
  const orgs = row?.organizations;
  if (!Array.isArray(orgs)) {
    return [];
  }
  const ids: string[] = [];
  for (const org of orgs) {
    const id = relationDocumentId(org);
    if (id) ids.push(id);
  }
  return ids;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/**
 * Target documentIds of a relation write: `'id'`, `{ documentId }`,
 * `{ connect: ... }` or `{ set: ... }` (each as a single item or an array).
 * `disconnect` only removes links, so it is not a target.
 */
export function relationTargetDocumentIds(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim() ? [value.trim()] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => relationTargetDocumentIds(item));
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  const v = value as Record<string, unknown>;
  if (typeof v.documentId === 'string' && v.documentId.trim()) {
    return [v.documentId.trim()];
  }
  return [
    ...relationTargetDocumentIds(v.connect),
    ...relationTargetDocumentIds(v.set),
  ];
}

function transactionDocumentIdsFromReceiptData(
  data: Record<string, unknown>,
): string[] {
  return relationTargetDocumentIds(data.transactions);
}

async function assertTransactionsInAllowedOrgs(
  strapi: OrgScopeStrapi,
  transactionDocumentIds: string[],
  orgDocumentIds: string[],
): Promise<void> {
  const allowed = new Set(orgDocumentIds);
  for (const txId of transactionDocumentIds) {
    const row = await strapi.db.query(TRANSACTION_UID).findOne({
      where: { documentId: txId },
      populate: { organization: { fields: ['documentId'] } },
    });
    const orgId = relationDocumentId(
      row?.organization as Record<string, unknown> | undefined,
    );
    if (!orgId || !allowed.has(orgId)) {
      throw new errors.ForbiddenError(
        'Cannot use a transaction outside your organization access',
      );
    }
  }
}

function connectDocumentIds(data: Record<string, unknown>): string[] {
  return relationTargetDocumentIds(data.organization);
}

/**
 * Registers first in the Document Service chain so later middleware (e.g. publish guard) sees constrained params.
 */
export function registerOrgScopeMiddleware(strapi: OrgScopeStrapi) {
  strapi.documents.use(async (context, next) => {
    const ctx = strapi.requestContext.get();
    const strategyName = ctx?.state?.auth?.strategy?.name;
    const actor = await contentApiActor(strapi as PublishGuardStrapi);
    const roleType = actor?.roleType ?? null;

    if (
      strategyName === 'users-permissions' &&
      roleType != null &&
      ORG_SCOPE_BYPASS_CONTENT_ROLE_TYPES.has(roleType)
    ) {
      return next();
    }

    if (
      !shouldApplyOrgScope({
        uid: context.uid,
        action: context.action,
        strategyName,
        roleType,
      })
    ) {
      return next();
    }

    const userId = ctx?.state?.user?.id;
    if (userId == null) {
      return next();
    }

    const orgDocumentIds = await loadUserOrgDocumentIds(strapi, userId);

    const params = (context.params ?? {}) as Record<string, unknown>;
    context.params = params;

    const readOrCountActions = new Set([
      'findMany',
      'findFirst',
      'findOne',
      'count',
    ]);

    const isOrganizationUid = context.uid === ORGANIZATION_UID;

    if (readOrCountActions.has(context.action)) {
      params.filters = mergeScopedFilter(
        context.uid,
        params.filters as Record<string, unknown> | undefined,
        orgDocumentIds,
      );
    }

    if (isOrganizationUid) {
      return next();
    }

    if (context.action === 'create') {
      const data = asRecord(params.data);
      params.data = data;
      if (orgDocumentIds.length === 0) {
        throw new errors.ForbiddenError(
          'No organization access for this user; cannot create this document.',
        );
      }
      if (context.uid === RECEIPT_UID) {
        const txIds = transactionDocumentIdsFromReceiptData(data);
        if (txIds.length === 0) {
          throw new errors.ValidationError(
            'transactions must be set to create a receipt',
          );
        }
        await assertTransactionsInAllowedOrgs(strapi, txIds, orgDocumentIds);
      } else {
        const requested = connectDocumentIds(data);
        if (requested.length === 0) {
          if (orgDocumentIds.length === 1) {
            data.organization = { connect: [orgDocumentIds[0]] };
          } else {
            throw new errors.ValidationError(
              'organization must be set for this user with multiple organization memberships',
            );
          }
        } else {
          const allowed = new Set(orgDocumentIds);
          for (const id of requested) {
            if (!allowed.has(id)) {
              throw new errors.ForbiddenError(
                'Cannot create a document for an organization outside your access',
              );
            }
          }
        }
      }
    }

    if (DOCUMENT_LIFECYCLE_ACTIONS.has(context.action)) {
      const documentId = params.documentId;
      if (typeof documentId === 'string' && documentId.length > 0) {
        if (orgDocumentIds.length === 0) {
          throw new errors.ForbiddenError(
            'No organization access for this user; cannot modify this document.',
          );
        }
        const allowedSet = new Set(orgDocumentIds);
        if (context.uid === RECEIPT_UID) {
          const row = await strapi.db.query(RECEIPT_UID).findOne({
            where: { documentId },
            populate: {
              transactions: {
                populate: { organization: { fields: ['documentId'] } },
              },
            },
          });
          if (!row) {
            throw new errors.ForbiddenError(
              'This document is not visible for your organization access',
            );
          }
          const linked = (row as { transactions?: unknown }).transactions;
          const transactions = Array.isArray(linked) ? linked : [];
          const visible = transactions.some((tx) => {
            const orgId = relationDocumentId(
              (tx as { organization?: unknown })?.organization as
                Record<string, unknown> | undefined,
            );
            return orgId != null && allowedSet.has(orgId);
          });
          if (!visible) {
            throw new errors.ForbiddenError(
              'This document is not visible for your organization access',
            );
          }
        } else {
          const row = await strapi.db.query(context.uid).findOne({
            where: { documentId },
            populate: { organization: { fields: ['documentId'] } },
          });
          if (!row) {
            throw new errors.ForbiddenError(
              'This document is not visible for your organization access',
            );
          }
          const r = row as { organization?: unknown };
          const orgId = relationDocumentId(
            r.organization as Record<string, unknown> | undefined,
          );
          if (!orgId || !allowedSet.has(orgId)) {
            throw new errors.ForbiddenError(
              'This document is not visible for your organization access',
            );
          }
        }
      }
    }

    if (context.action === 'update' && context.uid === RECEIPT_UID) {
      const data = asRecord(params.data);
      const txIds = transactionDocumentIdsFromReceiptData(data);
      if (txIds.length > 0) {
        await assertTransactionsInAllowedOrgs(strapi, txIds, orgDocumentIds);
      }
    }

    if (context.action === 'update' && context.uid === TRANSACTION_UID) {
      const data = asRecord(params.data);
      const requested = connectDocumentIds(data);
      if (requested.length > 0) {
        const allowed = new Set(orgDocumentIds);
        for (const id of requested) {
          if (!allowed.has(id)) {
            throw new errors.ForbiddenError(
              'Cannot point a transaction at an organization outside your access',
            );
          }
        }
      }
    }

    return next();
  });
}
