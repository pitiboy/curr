import {
  ensureStaticPageLocales,
  migrateLegalPagesToStaticPages,
  STATIC_PAGE_PUBLIC_ACTIONS,
  registerStaticPageRoutes,
  registerStaticPageSlugGuard,
} from './static-pages';
import { createPublishPolicyLoader } from './backoffice-features/policy';
import { registerPublishGuard } from './publish-guard';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const backofficeFeatureSeed = require(path.join(
  process.cwd(),
  'database/seeders/backoffice-features.js',
));
import { backfillMemberAccounts } from './member-accounts';
import { ensureReceiptTypes } from './receipt-types';
import { ensureTransactionImportKeyIndex } from './transaction-import-key';

const enabled = { enabled: true, policy: '' };

function allow(actions: string[]) {
  return Object.fromEntries(actions.map((action) => [action, enabled]));
}

/** Auth actions not returned by getActions() but required for Content users. */
const CONTENT_ROLE_AUTH_ACTIONS = [
  'plugin::users-permissions.auth.changePassword',
] as const;

/** Content API actions for dataentry and editor (no delete). */
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
  'api::currency-type.currency-type.find',
  'api::currency-type.currency-type.findOne',
  'api::currency-rate.currency-rate.find',
  'api::currency-rate.currency-rate.findOne',
  'api::member.member.find',
  'api::member.member.findOne',
  'api::membership.membership.find',
  'api::membership.membership.findOne',
  'api::membership-type.membership-type.find',
  'api::membership-type.membership-type.findOne',
  'api::transaction-type.transaction-type.find',
  'api::transaction-type.transaction-type.findOne',
  'api::receipt-type.receipt-type.find',
  'api::receipt-type.receipt-type.findOne',
  'plugin::upload.content-api.upload',
  'plugin::users-permissions.user.me',
  'api::backoffice.backoffice.config',
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
  'api::currency-type': {
    controllers: {
      'currency-type': allow(['find', 'findOne']),
    },
  },
  'api::currency-rate': {
    controllers: {
      'currency-rate': allow(['find', 'findOne']),
    },
  },
  'api::member': {
    controllers: {
      member: allow(['find', 'findOne']),
    },
  },
  'api::membership': {
    controllers: {
      membership: allow(['find', 'findOne']),
    },
  },
  'api::membership-type': {
    controllers: {
      'membership-type': allow(['find', 'findOne']),
    },
  },
  'api::transaction-type': {
    controllers: {
      'transaction-type': allow(['find', 'findOne']),
    },
  },
  'api::receipt-type': {
    controllers: {
      'receipt-type': allow(['find', 'findOne']),
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
  'api::backoffice': {
    controllers: {
      backoffice: allow(['config']),
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
    name: 'editor',
    type: 'editor',
    description: 'Tranzakció és nyugta rögzítése, ellenőrzése és közzététele.',
  },
];

/** Previous editor role type. Renamed in place so assigned users keep the role. */
const LEGACY_EDITOR_ROLE_TYPE = 'qa';

type StrapiLike = {
  db: {
    query: (uid: string) => {
      findOne: (params: Record<string, unknown>) => Promise<{ id: number } | null>;
      create: (params: { data: Record<string, unknown> }) => Promise<{ id: number }>;
      update: (params: {
        where: { id: number };
        data: Record<string, unknown>;
      }) => Promise<{ id: number }>;
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
    const roles = strapi.db.query('plugin::users-permissions.role');
    let role = await roles.findOne({
      where: { type: roleDef.type },
    });
    let renamed = false;

    if (!role && roleDef.type === 'editor') {
      const legacy = await roles.findOne({
        where: { type: LEGACY_EDITOR_ROLE_TYPE },
      });
      if (legacy) {
        await roles.update({
          where: { id: legacy.id },
          data: {
            name: roleDef.name,
            type: roleDef.type,
            description: roleDef.description,
          },
        });
        role = await roles.findOne({
          where: { type: roleDef.type },
        });
        renamed = true;
        strapi.log.info(
          `Renamed users-permissions role "${LEGACY_EDITOR_ROLE_TYPE}" to "${roleDef.type}"`,
        );
      }
    }

    if (!role) {
      await roleService.createRole({
        ...roleDef,
        permissions: usersPermissionsRolePermissions,
      });
      role = await roles.findOne({
        where: { type: roleDef.type },
      });
      strapi.log.info(`Created users-permissions role "${roleDef.type}"`);
    } else if (!renamed) {
      strapi.log.info(`Users-permissions role "${roleDef.type}" already exists`);
    }

    if (!role) {
      throw new Error(`Failed to ensure role "${roleDef.type}"`);
    }

    for (const action of [
      ...CONTENT_ROLE_ACTIONS,
      ...CONTENT_ROLE_AUTH_ACTIONS,
    ]) {
      if (
        !CONTENT_ROLE_AUTH_ACTIONS.includes(
          action as (typeof CONTENT_ROLE_AUTH_ACTIONS)[number],
        ) &&
        !isActionInCatalog(actionCatalog, action)
      ) {
        strapi.log.warn(
          `Content role bootstrap: action "${action}" not in getActions(), skipped`,
        );
        continue;
      }
      await ensurePermission(strapi, role.id, action);
    }
  }
}

/**
 * Static pages (privacy policy, terms of service) are readable without login:
 * the Google OAuth consent screen links to them. Same additive pattern as the
 * content roles: missing permissions are created, existing ones are kept.
 */
async function ensurePublicStaticPagePermissions(strapi: StrapiLike) {
  const role = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });
  if (!role) {
    strapi.log.warn('Static pages bootstrap: public role not found, skipped');
    return;
  }

  const actionCatalog = strapi
    .plugin('users-permissions')
    .service('users-permissions')
    .getActions();

  for (const action of STATIC_PAGE_PUBLIC_ACTIONS) {
    if (!isActionInCatalog(actionCatalog, action)) {
      strapi.log.warn(
        `Static pages bootstrap: action "${action}" not in getActions(), skipped`,
      );
      continue;
    }
    await ensurePermission(strapi, role.id, action);
  }
}

type GrantStore = Record<string, Record<string, unknown>>;

async function ensureGoogleOAuthGrant(strapi: StrapiLike & {
  config: { get: (key: string) => unknown };
  store: (params: { type: string; name: string }) => {
    get: (params: { key: string }) => Promise<unknown>;
    set: (params: { key: string; value: unknown }) => Promise<void>;
  };
}) {
  const pluginConfig = strapi.config.get('plugin::users-permissions') as {
    grant?: { google?: Record<string, unknown> };
  };
  const googleFromConfig = pluginConfig?.grant?.google;
  if (!googleFromConfig) {
    return;
  }

  const pluginStore = strapi.store({
    type: 'plugin',
    name: 'users-permissions',
  });
  const grant =
    ((await pluginStore.get({ key: 'grant' })) as GrantStore | null) ?? {};
  const prev = grant.google ?? {};
  const next = {
    ...prev,
    enabled: googleFromConfig.enabled ?? prev.enabled,
    icon: prev.icon ?? 'google',
    key: googleFromConfig.key ?? prev.key,
    secret: googleFromConfig.secret ?? prev.secret,
    callback: googleFromConfig.callback ?? prev.callback,
  };

  if (
    prev.enabled === next.enabled &&
    prev.key === next.key &&
    prev.secret === next.secret &&
    prev.callback === next.callback
  ) {
    return;
  }

  grant.google = next;
  await pluginStore.set({ key: 'grant', value: grant });
  strapi.log.info('Synced users-permissions Google grant from config');
}

export default {
  register({ strapi }) {
    registerPublishGuard(strapi, createPublishPolicyLoader(strapi));
    registerStaticPageRoutes(strapi);
    registerStaticPageSlugGuard(strapi);

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
    const seedInstance = process.env.BACKOFFICE_FEATURES_INSTANCE?.trim();
    if (seedInstance) {
      const seedPath =
        backofficeFeatureSeed.resolveBackofficeFeaturesSeedPath(seedInstance);
      try {
        await backofficeFeatureSeed.upsertBackofficeFeaturesFromFile(
          strapi,
          seedPath,
        );
      } catch (error) {
        strapi.log.warn(
          `Settings seed skipped for instance "${seedInstance}": ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    await ensureUsersPermissionsRoles(strapi);
    await ensureReceiptTypes(strapi);
    await ensureTransactionImportKeyIndex(strapi);
    await backfillMemberAccounts(strapi);
    await ensureGoogleOAuthGrant(strapi);
    await migrateLegalPagesToStaticPages(strapi);
    await ensureStaticPageLocales(strapi);
    await ensurePublicStaticPagePermissions(strapi);
  },
};
