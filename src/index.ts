const enabled = { enabled: true, policy: '' };

function allow(actions: string[]) {
  return Object.fromEntries(actions.map((action) => [action, enabled]));
}

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

async function ensureUsersPermissionsRoles(strapi: {
  db: {
    query: (uid: string) => {
      findOne: (params: { where: { type: string } }) => Promise<{ id: number } | null>;
    };
  };
  plugin: (name: string) => {
    service: (name: string) => {
      createRole: (params: Record<string, unknown>) => Promise<void>;
    };
  };
  log: { info: (message: string) => void };
}) {
  const roleService = strapi.plugin('users-permissions').service('role');

  for (const role of usersPermissionsRoles) {
    const existing = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: role.type },
    });

    if (existing) {
      strapi.log.info(`Users-permissions role "${role.type}" already exists`);
      continue;
    }

    await roleService.createRole({
      ...role,
      permissions: usersPermissionsRolePermissions,
    });
    strapi.log.info(`Created users-permissions role "${role.type}"`);
  }
}

export default {
  register({ strapi }) {
    // Behind TLS-terminating proxies (cPanel Passenger, Nginx, ALB) the Node
    // socket is plain HTTP. The `cookies` package checks socket.encrypted and
    // rejects Secure admin session cookies unless we mark the hop as trusted.
    strapi.server.use(async (ctx, next) => {
      const forwarded = ctx.get('x-forwarded-proto');
      const publicUrl = process.env.PUBLIC_URL || '';
      const proxied = process.env.IS_PROXIED === 'true' || process.env.NODE_ENV === 'production';
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
