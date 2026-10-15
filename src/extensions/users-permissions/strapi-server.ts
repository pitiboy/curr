type UsersPermissionsPlugin = {
  controllers: {
    user: {
      me: (ctx: MeContext) => Promise<void>;
    };
  };
};

type MeContext = {
  state: {
    user?: {
      role?: {
        id?: number;
        name?: string;
        description?: string;
        type?: string;
      };
    };
  };
  body?: Record<string, unknown>;
};

/**
 * Content API sanitize drops the user `role` relation unless the caller can
 * `role.find`, and that action also opens the roles list. `/users/me` puts
 * the caller's own role back from the authenticated user already loaded
 * with `populate: ['role']`.
 */
module.exports = (plugin: UsersPermissionsPlugin) => {
  const originalMe = plugin.controllers.user.me;

  plugin.controllers.user.me = async (ctx: MeContext) => {
    await originalMe(ctx);

    const role = ctx.state.user?.role;
    if (!role || !ctx.body || typeof ctx.body !== 'object') {
      return;
    }

    ctx.body.role = {
      id: role.id,
      name: role.name,
      description: role.description,
      type: role.type,
    };
  };

  return plugin;
};
