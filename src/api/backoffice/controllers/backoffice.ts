import { buildBackofficeConfig } from '../config';

type ConfigContext = {
  body: unknown;
};

export default {
  config(ctx: ConfigContext) {
    ctx.body = buildBackofficeConfig(process.env);
  },
};
