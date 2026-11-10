export type AuditSink = 'db' | 'stdout' | 'both';

export type AuditConfig = {
  enabled: boolean;
  sink: AuditSink;
  methods: Set<string>;
  pathPrefixes: string[];
  alwaysPaths: Set<string>;
  excludePaths: string[];
  includeBody: boolean;
  maxBodyBytes: number;
  redactKeys: Set<string>;
  retentionDays: number;
};

const DEFAULT_SINK: AuditSink = 'both';
const DEFAULT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const DEFAULT_PATH_PREFIXES = ['/api/', '/admin/', '/content-manager/'];
const DEFAULT_ALWAYS_PATHS = [
  '/api/auth/local',
  '/api/auth/local/register',
  '/admin/login',
  '/admin/register-admin',
  '/api/auth/google/callback',
];
const DEFAULT_EXCLUDE_PATHS = ['/_health', '/admin/renew-token'];
const DEFAULT_REDACT_KEYS = [
  'password',
  'currentPassword',
  'passwordConfirmation',
  'newPassword',
  'token',
  'jwt',
  'secret',
  'code',
  'access_token',
  'refresh_token',
  'id_token',
  'apiKey',
  'resetPasswordToken',
];

function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (raw == null || raw.trim() === '') {
    return fallback;
  }
  const items = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return items.length > 0 ? items : fallback;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === '') {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return fallback;
}

function parseIntEnv(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') {
    return fallback;
  }
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(value) ? value : fallback;
}

function parseSink(raw: string | undefined): AuditSink {
  const value = raw?.trim().toLowerCase();
  if (value === 'db' || value === 'stdout' || value === 'both') {
    return value;
  }
  return DEFAULT_SINK;
}

function pathWithoutQuery(path: string): string {
  const queryIndex = path.indexOf('?');
  return queryIndex >= 0 ? path.slice(0, queryIndex) : path;
}

function matchesPrefix(path: string, prefix: string): boolean {
  return (
    path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(prefix)
  );
}

export function readAuditConfig(
  env: Record<string, string | undefined>,
): AuditConfig {
  const methods = parseList(env.AUDIT_LOG_METHODS, DEFAULT_METHODS).map((m) =>
    m.toUpperCase(),
  );
  const alwaysPaths = parseList(
    env.AUDIT_LOG_ALWAYS_PATHS,
    DEFAULT_ALWAYS_PATHS,
  );

  return {
    enabled: parseBool(env.AUDIT_LOG_ENABLED, true),
    sink: parseSink(env.AUDIT_LOG_SINK),
    methods: new Set(methods),
    pathPrefixes: parseList(env.AUDIT_LOG_PATH_PREFIXES, DEFAULT_PATH_PREFIXES),
    alwaysPaths: new Set(alwaysPaths),
    excludePaths: parseList(env.AUDIT_LOG_EXCLUDE_PATHS, DEFAULT_EXCLUDE_PATHS),
    includeBody: parseBool(env.AUDIT_LOG_INCLUDE_BODY, true),
    maxBodyBytes: parseIntEnv(env.AUDIT_LOG_MAX_BODY_BYTES, 8192),
    redactKeys: new Set(
      parseList(env.AUDIT_LOG_REDACT_KEYS, DEFAULT_REDACT_KEYS).map((key) =>
        key.toLowerCase(),
      ),
    ),
    retentionDays: parseIntEnv(env.AUDIT_LOG_RETENTION_DAYS, 365),
  };
}

export function shouldAudit(
  cfg: AuditConfig,
  method: string,
  path: string,
): boolean {
  if (!cfg.enabled) {
    return false;
  }

  const normalizedPath = pathWithoutQuery(path);
  const normalizedMethod = method.toUpperCase();

  for (const exclude of cfg.excludePaths) {
    if (matchesPrefix(normalizedPath, exclude)) {
      return false;
    }
  }

  if (cfg.alwaysPaths.has(normalizedPath)) {
    return true;
  }

  const prefixMatch = cfg.pathPrefixes.some((prefix) =>
    normalizedPath.startsWith(prefix),
  );
  if (prefixMatch && cfg.methods.has(normalizedMethod)) {
    return true;
  }

  return false;
}

export function isInvalidAuditSink(
  env: Record<string, string | undefined>,
): boolean {
  const raw = env.AUDIT_LOG_SINK?.trim().toLowerCase();
  if (raw == null || raw === '') {
    return false;
  }
  return raw !== 'db' && raw !== 'stdout' && raw !== 'both';
}
