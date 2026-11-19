import { errors } from '@strapi/utils';

import { relationTargetDocumentIds } from '../org-scope-middleware';
import { ASSET_OWNERSHIP_TYPES, ASSET_STATUSES, ASSET_UID } from './constants';

type DocumentMiddlewareContext = {
  uid: string;
  action: string;
  params?: Record<string, unknown>;
};

type AssetGuardStrapi = {
  documents: {
    use: (
      fn: (
        context: DocumentMiddlewareContext,
        next: () => Promise<unknown>,
      ) => Promise<unknown>,
    ) => void;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clearsRelation(value: unknown): boolean {
  if (value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  const record = asRecord(value);
  if ('set' in record) {
    const set = record.set;
    return set == null || (Array.isArray(set) && set.length === 0);
  }
  return false;
}

/**
 * Domain checks on asset writes (any actor). Enum values are also validated by
 * Strapi; this gives a clear message and covers Document Service callers.
 */
export function assertValidAssetData(
  data: Record<string, unknown>,
  options: { creating: boolean },
): void {
  if (
    data.ownership_type != null &&
    !(ASSET_OWNERSHIP_TYPES as readonly unknown[]).includes(data.ownership_type)
  ) {
    throw new errors.ValidationError(
      `ownership_type must be one of: ${ASSET_OWNERSHIP_TYPES.join(', ')}`,
    );
  }
  if (
    data.status != null &&
    !(ASSET_STATUSES as readonly unknown[]).includes(data.status)
  ) {
    throw new errors.ValidationError(
      `status must be one of: ${ASSET_STATUSES.join(', ')}`,
    );
  }
  if (data.purchase_price != null && data.purchase_price !== '') {
    const price = Number(data.purchase_price);
    if (!Number.isFinite(price) || price < 0) {
      throw new errors.ValidationError(
        'purchase_price must be a non-negative number',
      );
    }
  }
  if (options.creating) {
    if (relationTargetDocumentIds(data.organization).length === 0) {
      throw new errors.ValidationError('organization is required for an asset');
    }
  } else if ('organization' in data && clearsRelation(data.organization)) {
    throw new errors.ValidationError(
      'organization cannot be removed from an asset',
    );
  }
}

/** Registered after the org-scope middleware, so a single-org default is already set. */
export function registerAssetGuard(strapi: AssetGuardStrapi): void {
  strapi.documents.use(async (context, next) => {
    if (
      context.uid === ASSET_UID &&
      (context.action === 'create' || context.action === 'update')
    ) {
      assertValidAssetData(asRecord(context.params?.data), {
        creating: context.action === 'create',
      });
    }
    return next();
  });
}
