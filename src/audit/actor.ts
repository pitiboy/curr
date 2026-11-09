export type AuditActorType = 'user' | 'admin' | 'api-token' | 'anonymous';

export type AuditActor = {
  type: AuditActorType;
  id?: string | number | null;
  label?: string | null;
  role?: string | null;
};

type ActorUser = {
  id?: number | string;
  email?: string;
  username?: string;
  role?: { type?: string };
  roles?: Array<{ code?: string }>;
};

type ActorContext = {
  state?: {
    auth?: { strategy?: { name?: string } };
    user?: ActorUser;
  };
  body?: unknown;
  status?: number;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function resolveActor(ctx: ActorContext): AuditActor {
  const strategy = ctx.state?.auth?.strategy?.name;
  const user = ctx.state?.user;

  if (strategy === 'users-permissions' && user) {
    return {
      type: 'user',
      id: user.id ?? null,
      label: user.email ?? user.username ?? null,
      role: user.role?.type ?? null,
    };
  }

  if (strategy === 'admin' && user) {
    const roleCodes =
      user.roles
        ?.map((role) => role.code)
        .filter(
          (code): code is string => typeof code === 'string' && code.length > 0,
        )
        .join(',') ?? null;
    return {
      type: 'admin',
      id: user.id ?? null,
      label: user.email ?? user.username ?? null,
      role: roleCodes,
    };
  }

  if (strategy === 'api-token') {
    const credentials = asObject(
      (ctx.state?.auth as { credentials?: unknown } | undefined)?.credentials,
    );
    return {
      type: 'api-token',
      id:
        typeof credentials?.id === 'number' ||
        typeof credentials?.id === 'string'
          ? credentials.id
          : null,
      label: typeof credentials?.name === 'string' ? credentials.name : null,
      role: null,
    };
  }

  return { type: 'anonymous' };
}

export function resolveLoginActor(
  ctx: ActorContext,
  path: string,
  body: unknown,
  alwaysPaths: Set<string>,
  status: number,
): AuditActor {
  const base = resolveActor(ctx);
  if (!alwaysPaths.has(path) || base.type !== 'anonymous') {
    return base;
  }

  const bodyObj = asObject(body);
  const label =
    (typeof bodyObj?.identifier === 'string' && bodyObj.identifier) ||
    (typeof bodyObj?.email === 'string' && bodyObj.email) ||
    null;

  let id: string | number | null = null;
  if (status >= 200 && status < 300) {
    const response = asObject(ctx.body);
    const usersPermissionsId = asObject(response?.user)?.id;
    const adminId = asObject(asObject(response?.data)?.user)?.id;
    const resolved = usersPermissionsId ?? adminId;
    if (typeof resolved === 'number' || typeof resolved === 'string') {
      id = resolved;
    }
  }

  return {
    type: 'anonymous',
    id,
    label,
    role: null,
  };
}
