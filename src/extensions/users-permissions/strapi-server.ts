import {
  decideOAuthLink,
  isLinkableProvider,
  normalizeEmail,
  OAUTH_ERROR,
  toOAuthErrorCode,
} from '../../oauth-link';

type OAuthData = Record<string, unknown> & {
  access_token?: string;
  code?: string;
  oauth_token?: string;
  id_token?: string;
};

type ConnectOptions = { grantResponse?: unknown };

type ProvidersService = {
  connect: (
    provider: string,
    oauthData: OAuthData,
    options?: ConnectOptions,
  ) => Promise<Record<string, unknown>>;
  [key: string]: unknown;
};

type ProvidersStrapi = {
  store: (params: { type: string; name: string; key: string }) => {
    get: () => Promise<unknown>;
  };
  plugin: (name: string) => {
    service: (name: string) => {
      run: (params: Record<string, unknown>) => Promise<{ email?: string } | null>;
    };
  };
  db: {
    query: (uid: string) => {
      findMany: (params: Record<string, unknown>) => Promise<
        Array<{
          id: number;
          email?: string;
          provider?: string;
          blocked?: boolean;
          confirmed?: boolean;
        }>
      >;
    };
  };
  log: { info: (message: string) => void; warn: (message: string) => void };
};

type ProvidersFactory = (deps: { strapi: ProvidersStrapi }) => ProvidersService;

type UsersPermissionsPlugin = {
  controllers: {
    user: {
      me: (ctx: MeContext) => Promise<void>;
    };
  };
  services: {
    providers: ProvidersFactory;
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

function upStore(strapi: ProvidersStrapi, key: string) {
  return strapi.store({ type: 'plugin', name: 'users-permissions', key });
}

/**
 * Google login reaches an admin-created user with the same email (see
 * src/oauth-link.ts). Same steps as stock connect up to the user lookup; the
 * stock connect still handles every case the decision leaves to it (unknown
 * email: reject or register, per Advanced Settings). The user row is not
 * written, so `provider: 'local'` and password login keep working.
 */
function withExistingUserLink(originalFactory: ProvidersFactory): ProvidersFactory {
  return (deps) => {
    const service = originalFactory(deps);
    const stockConnect = service.connect;
    const { strapi } = deps;

    /** Stock connect, with its known error messages turned into codes. */
    const stockConnectWithCodes: ProvidersService['connect'] = async (
      provider,
      oauthData,
      options,
    ) => {
      try {
        return await stockConnect(provider, oauthData, options);
      } catch (error) {
        if (error instanceof Error) {
          error.message = toOAuthErrorCode(error.message);
        }
        throw error;
      }
    };

    const connect: ProvidersService['connect'] = async (
      provider,
      oauthData,
      options = {},
    ) => {
      if (!isLinkableProvider(provider)) {
        return stockConnect(provider, oauthData, options);
      }

      const accessToken =
        oauthData?.access_token || oauthData?.code || oauthData?.oauth_token;
      if (!accessToken && !oauthData?.id_token) {
        throw new Error('No access_token.');
      }

      const profile = await strapi
        .plugin('users-permissions')
        .service('providers-registry')
        .run({
          provider,
          query: oauthData,
          accessToken,
          providers: await upStore(strapi, 'grant').get(),
          grantResponse: options.grantResponse,
        });
      const email = normalizeEmail(profile?.email);
      if (!email) {
        throw new Error(OAUTH_ERROR.emailNotAvailable);
      }

      const users = await strapi.db
        .query('plugin::users-permissions.user')
        .findMany({ where: { email: { $eqi: email } } });
      const advanced = (await upStore(strapi, 'advanced').get()) as {
        email_confirmation?: boolean;
      } | null;

      const decision = decideOAuthLink(provider, email, users, advanced);
      if (decision.type === 'stock') {
        return stockConnectWithCodes(provider, oauthData, options);
      }
      if (decision.type === 'reject') {
        strapi.log.warn(
          `OAuth ${provider} login for existing user refused: ${decision.reason}`,
        );
        throw new Error(decision.message);
      }
      if (decision.linked) {
        strapi.log.info(
          `OAuth ${provider} login linked to existing user id=${decision.user.id}`,
        );
      }
      return decision.user;
    };

    return { ...service, connect };
  };
}

/**
 * Content API sanitize drops the user `role` relation unless the caller can
 * `role.find`, and that action also opens the roles list. `/users/me` puts
 * the caller's own role back from the authenticated user already loaded
 * with `populate: ['role']`.
 */
module.exports = (plugin: UsersPermissionsPlugin) => {
  plugin.services.providers = withExistingUserLink(plugin.services.providers);

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
