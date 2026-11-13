import { ReconciliationError } from './errors';
import { reconciliationForRequest, type ReconciliationStrapi } from './report';

export type ReconciliationHandlerCtx = {
  status?: number;
  body?: unknown;
};

export async function handleReconciliation(
  strapi: ReconciliationStrapi,
  ctx: ReconciliationHandlerCtx,
): Promise<void> {
  try {
    ctx.body = await reconciliationForRequest(strapi);
  } catch (error) {
    if (error instanceof ReconciliationError) {
      ctx.status = error.status;
      ctx.body = {
        data: null,
        error: {
          status: error.status,
          name: error.name,
          message: error.message,
        },
      };
      return;
    }
    throw error;
  }
}
