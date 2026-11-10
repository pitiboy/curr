/**
 * HTTP handlers for the controller-only transaction delete and
 * purge-expansion actions. Kept free of `@strapi/strapi` so the Koa-level
 * behaviour (status codes, error body, core delete fallback) is unit-testable.
 */
import {
  deleteTransactionWithReceipts,
  purgeExpansion,
  TransactionDeleteError,
  type TransactionDeleteStrapi,
} from './delete-service';

export type DeleteHandlerCtx = {
  params?: { id?: unknown };
  state?: { auth?: { strategy?: { name?: string } } };
  status?: number;
  body?: unknown;
};

export function documentIdParam(ctx: DeleteHandlerCtx): string {
  const rawId = ctx.params?.id;
  return typeof rawId === 'string' ? rawId.trim() : '';
}

export function writeDeleteError(
  ctx: DeleteHandlerCtx,
  error: TransactionDeleteError,
): void {
  ctx.status = error.status;
  ctx.body = {
    data: null,
    error: {
      status: error.status,
      name: error.name,
      message: error.message,
    },
  };
}

/**
 * Content API users (controller role) go through the guarded delete with
 * receipt cascade. API tokens (seeders, reset scripts) keep the core delete.
 */
export async function handleTransactionDelete(
  strapi: TransactionDeleteStrapi,
  ctx: DeleteHandlerCtx,
  coreDelete: () => Promise<unknown>,
): Promise<unknown> {
  if (ctx.state?.auth?.strategy?.name !== 'users-permissions') {
    return coreDelete();
  }
  try {
    await deleteTransactionWithReceipts(strapi, documentIdParam(ctx));
  } catch (error) {
    if (error instanceof TransactionDeleteError) {
      writeDeleteError(ctx, error);
      return undefined;
    }
    throw error;
  }
  ctx.status = 204;
  return undefined;
}

export async function handlePurgeExpansion(
  strapi: TransactionDeleteStrapi,
  ctx: DeleteHandlerCtx,
): Promise<void> {
  const documentId = documentIdParam(ctx);
  try {
    const result = await purgeExpansion(strapi, documentId);
    ctx.body = { data: { documentId, ...result } };
  } catch (error) {
    if (error instanceof TransactionDeleteError) {
      writeDeleteError(ctx, error);
      return;
    }
    throw error;
  }
}
