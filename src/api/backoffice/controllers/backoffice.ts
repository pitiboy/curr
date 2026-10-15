import { selectWorkflows } from '../workflows';

type ConfigContext = {
  body: unknown;
};

export default {
  config(ctx: ConfigContext) {
    ctx.body = selectWorkflows(process.env.BACKOFFICE_WORKFLOWS);
  },
};
