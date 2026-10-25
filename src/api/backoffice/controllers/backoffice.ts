import { loadBackofficeConfig } from '../config';

type ConfigContext = {
  body: unknown;
};

export default {
  async config(ctx: ConfigContext) {
    ctx.body = await loadBackofficeConfig(strapi);
  },
};
