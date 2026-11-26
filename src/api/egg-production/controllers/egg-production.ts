import { TransactionWorkflowError } from '../../../transaction-workflow/convert';
import {
  submitEggEntries,
  type EggEntryRequestBody,
  type EggProductionStrapi,
} from '../../../egg-production/service';

type EggProductionCtx = {
  body?: unknown;
  status?: number;
  query?: Record<string, unknown>;
  request: { body?: unknown };
  state?: { user?: { id?: number | string } | null };
};

/** `?dryRun=1` (or body `dryRun: true`) plans and checks duplicates without writing. */
export function isDryRun(ctx: Pick<EggProductionCtx, 'query' | 'request'>) {
  const raw = ctx.query?.dryRun;
  if (raw === '1' || raw === 'true' || raw === true) return true;
  const body = ctx.request?.body as { dryRun?: unknown } | undefined;
  return body?.dryRun === true;
}

export default {
  async createEntries(ctx: EggProductionCtx) {
    try {
      const data = await submitEggEntries(
        strapi as unknown as EggProductionStrapi,
        {
          userId: ctx.state?.user?.id,
          body: (ctx.request.body ?? {}) as EggEntryRequestBody,
          dryRun: isDryRun(ctx),
        },
      );
      ctx.body = { data };
    } catch (error) {
      if (error instanceof TransactionWorkflowError) {
        ctx.status = error.status;
        ctx.body = {
          data: null,
          error: {
            status: error.status,
            name: error.name,
            message: error.message,
            details: { ...(error.details ?? {}), code: error.code },
          },
        };
        return;
      }
      throw error;
    }
  },
};
