import { contentApiActor, type PublishGuardStrapi } from '../publish-guard';
import {
  parseVoiceRequestBody,
  parseVoiceTransaction,
  type VoiceParseDeps,
} from './service';
import { VoiceParseError, type VoiceActor } from './types';

export type VoiceHandlerCtx = {
  request?: { body?: unknown };
  state?: { user?: { id?: number | string } };
  status?: number;
  body?: unknown;
};

export type VoiceLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

async function resolveActor(
  strapi: unknown,
  ctx: VoiceHandlerCtx,
): Promise<VoiceActor | null> {
  const actor = await contentApiActor(strapi as PublishGuardStrapi);
  const userId = ctx.state?.user?.id;
  if (!actor || userId == null) return null;
  return { userId, roleType: actor.roleType };
}

/**
 * Koa glue for `POST /api/transactions/parse-voice`. Logs transcript length
 * and outcome only, never the transcript itself.
 */
export async function handleParseVoice(
  deps: VoiceParseDeps,
  log: VoiceLogger,
  ctx: VoiceHandlerCtx,
): Promise<void> {
  const started = Date.now();
  const rawBody = ctx.request?.body as Record<string, unknown> | undefined;
  const transcriptLength =
    typeof rawBody?.transcript === 'string' ? rawBody.transcript.length : 0;
  let userId: number | string | undefined;
  try {
    const actor = await resolveActor(deps.strapi, ctx);
    userId = actor?.userId;
    const request = parseVoiceRequestBody(rawBody);
    const result = await parseVoiceTransaction(deps, actor, request);
    ctx.status = 200;
    ctx.body = { data: result };
    log.info(
      `[voice-parse] outcome=ok user=${userId} transcriptLength=${transcriptLength} confidence=${result.confidence.toFixed(2)} warnings=${result.warnings.length} ms=${Date.now() - started}`,
    );
  } catch (error) {
    if (error instanceof VoiceParseError) {
      ctx.status = error.status;
      ctx.body = {
        data: null,
        error: {
          status: error.status,
          name: error.name,
          message: error.message,
        },
      };
      log.warn(
        `[voice-parse] outcome=error status=${error.status} user=${userId ?? '-'} transcriptLength=${transcriptLength} ms=${Date.now() - started}${
          error.cause instanceof Error ? ` detail=${error.cause.message}` : ''
        }`,
      );
      return;
    }
    log.warn(
      `[voice-parse] outcome=exception user=${userId ?? '-'} transcriptLength=${transcriptLength} ms=${Date.now() - started}`,
    );
    throw error;
  }
}
