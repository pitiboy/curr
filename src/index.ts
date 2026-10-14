import { errors } from '@strapi/utils';

const enabled = { enabled: true, policy: '' };

function allow(actions: string[]) {
  return Object.fromEntries(actions.map((action) => [action, enabled]));
}

/** Content API actions for dataentry and qa (no delete). */
const CONTENT_ROLE_ACTIONS = [
  'api::transaction.transaction.find',
  'api::transaction.transaction.findOne',
  'api::transaction.transaction.create',
  'api::transaction.transaction.update',
  'api::receipt.receipt.find',
  'api::receipt.receipt.findOne',
  'api::receipt.receipt.create',
  'api::receipt.receipt.update',
  'api::organization.organization.find',
  'api::organization.organization.findOne',
  'api::account.account.find',
  'api::account.account.findOne',
  'plugin::upload.content-api.upload',
  'plugin::users-permissions.user.me',
] as const;

const usersPermissionsRolePermissions = {
  'api::transaction': {
    controllers: {
      transaction: allow(['find', 'findOne', 'create', 'update']),
    },
  },
  'api::receipt': {
    controllers: {
      receipt: allow(['find', 'findOne', 'create', 'update']),
    },
  },
  'api::organization': {
    controllers: {
      organization: allow(['find', 'findOne']),
    },
  },
  'api::account': {
    controllers: {
      account: allow(['find', 'findOne']),
    },
  },
  'plugin::upload': {
    controllers: {
      'content-api': allow(['upload']),
    },
  },
  'plugin::users-permissions': {
    controllers: {
      user: allow(['me']),
    },
  },
};

const usersPermissionsRoles = [
  {
    name: 'dataentry',
    type: 'dataentry',
    description: 'Tranzakció és nyugta rögzítése.',
  },
  {
    name: 'qa',
    type: 'qa',
    description: 'Tranzakció és nyugta ellenőrzése.',
  },
];

type StrapiLike = {
  db: {
    query: (uid: string) => {
      findOne: (params: Record<string, unknown>) => Promise<{ id: number } | null>;
      create: (params: { data: Record<string, unknown> }) => Promise<{ id: number }>;
    };
  };
  plugin: (name: string) => {
    service: (name: string) => {
      getActions: () => Record<string, { controllers?: Record<string, Record<string, unknown>> }>;
      createRole: (params: Record<string, unknown>) => Promise<void>;
    };
  };
  log: { info: (message: string) => void; warn: (message: string) => void };
};

function parseActionId(actionId: string) {
  const parts = actionId.split('.');
  const actionName = parts.pop();
  const controllerName = parts.pop();
  const typeName = parts.join('.');
  return { typeName, controllerName, actionName };
}

function isActionInCatalog(
  catalog: Record<string, { controllers?: Record<string, Record<string, unknown>> }>,
  actionId: string,
) {
  const { typeName, controllerName, actionName } = parseActionId(actionId);
  if (!typeName || !controllerName || !actionName) {
    return false;
  }
  return (
    catalog[typeName]?.controllers?.[controllerName]?.[actionName] !== undefined
  );
}

async function ensurePermission(
  strapi: StrapiLike,
  roleId: number,
  action: string,
) {
  const existing = await strapi.db
    .query('plugin::users-permissions.permission')
    .findOne({
      where: { action, role: roleId },
    });

  if (existing) {
    return;
  }

  await strapi.db.query('plugin::users-permissions.permission').create({
    data: { action, role: roleId },
  });
}

async function ensureUsersPermissionsRoles(strapi: StrapiLike) {
  const usersPermissionsService = strapi
    .plugin('users-permissions')
    .service('users-permissions');
  const roleService = strapi.plugin('users-permissions').service('role');
  const actionCatalog = usersPermissionsService.getActions();

  for (const roleDef of usersPermissionsRoles) {
    let role = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({
        where: { type: roleDef.type },
      });

    if (!role) {
      await roleService.createRole({
        ...roleDef,
        permissions: usersPermissionsRolePermissions,
      });
      role = await strapi.db
        .query('plugin::users-permissions.role')
        .findOne({
          where: { type: roleDef.type },
        });
      strapi.log.info(`Created users-permissions role "${roleDef.type}"`);
    } else {
      strapi.log.info(`Users-permissions role "${roleDef.type}" already exists`);
    }

    if (!role) {
      throw new Error(`Failed to ensure role "${roleDef.type}"`);
    }

    for (const action of CONTENT_ROLE_ACTIONS) {
      if (!isActionInCatalog(actionCatalog, action)) {
        strapi.log.warn(
          `Content role bootstrap: action "${action}" not in getActions(), skipped`,
        );
        continue;
      }
      await ensurePermission(strapi, role.id, action);
    }
  }
}

const PUBLISH_GUARDED_UIDS = new Set([
  'api::transaction.transaction',
  'api::receipt.receipt',
]);

function registerPublishGuard(strapi: {
  documents: {
    use: (
      middleware: (
        context: {
          uid: string;
          action: string;
          params?: { status?: string };
        },
        next: () => Promise<unknown>,
      ) => Promise<unknown>,
    ) => void;
  };
  requestContext: {
    get: () =>
      | {
          state?: {
            auth?: { strategy?: { name?: string } };
            user?: { role?: { type?: string } };
          };
        }
      | undefined;
  };
}) {
  strapi.documents.use(async (context, next) => {
    if (!PUBLISH_GUARDED_UIDS.has(context.uid)) {
      return next();
    }

    const ctx = strapi.requestContext.get();
    const strategyName = ctx?.state?.auth?.strategy?.name;
    const roleType = ctx?.state?.user?.role?.type;

    if (strategyName !== 'users-permissions' || roleType !== 'dataentry') {
      return next();
    }

    const status = context.params?.status;
    const writing = context.action === 'create' || context.action === 'update';
    const publishing =
      context.action === 'publish' ||
      context.action === 'unpublish' ||
      (writing && status === 'published');

    if (publishing) {
      throw new errors.ForbiddenError('Publishing is limited to the qa role');
    }

    return next();
  });
}

export default {
  register({ strapi }) {
    // TODO: Uncomment this when we have a way to publish transactions and receipts
    // registerPublishGuard(strapi);

    // Behind TLS-terminating proxies (cPanel Passenger, Nginx, ALB) the Node
    // socket is plain HTTP. The `cookies` package checks socket.encrypted and
    // rejects Secure admin session cookies unless we mark the hop as trusted.
    strapi.server.use(async (ctx, next) => {
      const forwarded = ctx.get('x-forwarded-proto');
      const publicUrl = process.env.PUBLIC_URL || '';
      const proxied =
        process.env.IS_PROXIED === 'true' ||
        process.env.NODE_ENV === 'production';
      const isHttps =
        forwarded === 'https' ||
        ctx.secure ||
        (proxied && publicUrl.startsWith('https://'));

      if (isHttps && ctx.req?.socket) {
        (ctx.req.socket as { encrypted?: boolean }).encrypted = true;
      }
      ctx.cookies.secure = isHttps;

      await next();
    });
  },
  async bootstrap({ strapi }) {
    await ensureUsersPermissionsRoles(strapi);
  },
};
