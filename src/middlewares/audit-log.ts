import { randomUUID } from 'node:crypto';

import type { Core } from '@strapi/strapi';

import { resolveLoginActor } from '../audit/actor';
import {
  isInvalidAuditSink,
  readAuditConfig,
  shouldAudit,
} from '../audit/config';
import { redact, truncateJson } from '../audit/redact';
import { writeAuditEntry } from '../audit/sink';

type AuditKoaContext = {
  method: string;
  path: string;
  status: number;
  state: Record<string, unknown>;
  body?: unknown;
  request: {
    body?: unknown;
    query?: Record<string, unknown>;
    ip?: string;
  };
  query?: Record<string, unknown>;
  get: (name: string) => string | undefined;
  set: (name: string, value: string) => void;
  _matchedRoute?: string;
  headers?: Record<string, string | string[] | undefined>;
};

const STATUS_BY_ERROR_NAME: Record<string, number> = {
  ValidationError: 400,
  ForbiddenError: 403,
  UnauthorizedError: 401,
  NotFoundError: 404,
  PayloadTooLargeError: 413,
  RateLimitError: 429,
  PolicyError: 403,
};

function resolveStatus(error: unknown, ctx: AuditKoaContext): number {
  if (!error) {
    return ctx.status ?? 200;
  }
  if (
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }
  const errorName =
    error instanceof Error
      ? error.name
      : typeof error === 'object' && error && 'name' in error
        ? String((error as { name: unknown }).name)
        : null;
  if (errorName) {
    const mapped = STATUS_BY_ERROR_NAME[errorName];
    if (mapped != null) {
      return mapped;
    }
  }
  if (ctx.status && ctx.status >= 400) {
    return ctx.status;
  }
  return 500;
}

function errorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function stringifyActorId(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  return String(value);
}

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  const cfg = readAuditConfig(process.env);
  if (isInvalidAuditSink(process.env)) {
    strapi.log.warn(
      `Invalid AUDIT_LOG_SINK (${process.env.AUDIT_LOG_SINK}); using both`,
    );
  }

  return async (ctx: AuditKoaContext, next: () => Promise<unknown>) => {
    if (!shouldAudit(cfg, ctx.method, ctx.path)) {
      return next();
    }

    const incomingId = ctx.get('x-request-id')?.trim();
    const requestId =
      incomingId && incomingId.length > 0 ? incomingId : randomUUID();
    ctx.state.requestId = requestId;
    ctx.set('X-Request-Id', requestId);

    const started = Date.now();
    const bodySnapshot = ctx.request.body;
    const querySnapshot = { ...(ctx.query ?? ctx.request.query ?? {}) };

    let error: unknown;
    try {
      await next();
    } catch (err) {
      error = err;
      throw err;
    } finally {
      try {
        const status = resolveStatus(error, ctx);
        const actor = resolveLoginActor(
          ctx,
          ctx.path,
          bodySnapshot,
          cfg.alwaysPaths,
          status,
        );

        const redactedQuery = redact(querySnapshot, cfg.redactKeys);
        let bodyValue: unknown = null;
        if (cfg.includeBody) {
          const redactedBody = redact(bodySnapshot, cfg.redactKeys);
          bodyValue = truncateJson(redactedBody, cfg.maxBodyBytes).value;
        }

        const matchedRoute = ctx._matchedRoute;
        const userAgent = ctx.get('user-agent') ?? null;

        await writeAuditEntry(strapi, cfg, {
          occurred_at: new Date().toISOString(),
          request_id: requestId,
          method: ctx.method,
          path: ctx.path,
          route: typeof matchedRoute === 'string' ? matchedRoute : null,
          query: redactedQuery,
          status,
          duration_ms: Date.now() - started,
          actor_type: actor.type,
          actor_id: stringifyActorId(actor.id),
          actor_label: actor.label ?? null,
          actor_role: actor.role ?? null,
          ip: ctx.request.ip ?? null,
          user_agent: userAgent,
          body: bodyValue,
          error: errorMessage(error),
        });
      } catch (auditErr) {
        strapi.log.warn(`audit write failed: ${String(auditErr)}`);
      }
    }
  };
};
