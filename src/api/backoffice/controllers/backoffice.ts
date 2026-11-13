import { handleReconciliation } from '../../../reconciliation/handler';
import { loadBackofficeConfig } from '../config';

type BackofficeCtx = {
  body?: unknown;
  status?: number;
};

export default {
  async config(ctx: BackofficeCtx) {
    ctx.body = await loadBackofficeConfig(strapi);
  },

  async reconciliation(ctx: BackofficeCtx) {
    await handleReconciliation(strapi, ctx);
  },
};
