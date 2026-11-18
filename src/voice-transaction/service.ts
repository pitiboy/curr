import { rolesFromFeatureConfig } from '../backoffice-features/parse';
import type { BackofficeFeatureRow } from '../backoffice-features/types';
import { loadVoiceParseContext, type VoiceContextStrapi } from './context';
import { LlmError, type LlmJsonClient } from './llm';
import {
  buildVoiceSystemPrompt,
  buildVoiceUserMessage,
  VOICE_PARSE_JSON_SCHEMA,
} from './prompt';
import type { RateLimiter } from './rate-limit';
import {
  VOICE_TRANSACTION_FEATURE_KEY,
  VOICE_TRANSCRIPT_MAX_LENGTH,
  VoiceParseError,
  type VoiceActor,
  type VoiceParseResult,
} from './types';
import { validateVoiceParseOutput } from './validate';

/** Content roles that may dictate (same as transaction create). */
export const VOICE_DEFAULT_ROLES = ['dataentry', 'editor', 'controller'];

export type VoiceParseDeps = {
  strapi: VoiceContextStrapi;
  loadFeatures: () => Promise<BackofficeFeatureRow[]>;
  llm: LlmJsonClient | null;
  rateLimiter: RateLimiter;
  now?: () => Date;
};

export type VoiceParseRequest = {
  transcript: string;
  organizationId: string | null;
};

/** Europe/Budapest calendar day as YYYY-MM-DD. */
export function budapestToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function parseVoiceRequestBody(body: unknown): VoiceParseRequest {
  const record =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const transcript =
    typeof record.transcript === 'string' ? record.transcript.trim() : '';
  if (!transcript) {
    throw new VoiceParseError('Üres diktálás.', 400);
  }
  if (transcript.length > VOICE_TRANSCRIPT_MAX_LENGTH) {
    throw new VoiceParseError(
      `A diktálás túl hosszú (legfeljebb ${VOICE_TRANSCRIPT_MAX_LENGTH} karakter).`,
      400,
    );
  }
  const rawOrg = record.organizationId;
  const organizationId =
    typeof rawOrg === 'string' && rawOrg.trim() ? rawOrg.trim() : null;
  return { transcript, organizationId };
}

function roleAllowed(allowed: readonly string[], role: string): boolean {
  if (allowed.includes(role)) return true;
  return role === 'controller' && allowed.includes('editor');
}

/**
 * Auth → feature flag → role → rate limit → org access → LLM → validation.
 * Never writes anything.
 */
export async function parseVoiceTransaction(
  deps: VoiceParseDeps,
  actor: VoiceActor | null,
  request: VoiceParseRequest,
): Promise<VoiceParseResult> {
  if (!actor) {
    throw new VoiceParseError('Bejelentkezés szükséges.', 401);
  }

  const features = await deps.loadFeatures();
  const feature = features.find(
    (row) => row.key === VOICE_TRANSACTION_FEATURE_KEY,
  );
  if (!feature?.enabled) {
    throw new VoiceParseError('A hangalapú rögzítés nincs bekapcsolva.', 403);
  }
  const configuredRoles = rolesFromFeatureConfig(feature.config);
  const allowedRoles =
    configuredRoles.length > 0 ? configuredRoles : VOICE_DEFAULT_ROLES;
  if (!roleAllowed(allowedRoles, actor.roleType)) {
    throw new VoiceParseError(
      'Ehhez a szerepkörhöz nem engedélyezett a hangalapú rögzítés.',
      403,
    );
  }

  if (!deps.rateLimiter.take(String(actor.userId))) {
    throw new VoiceParseError(
      'Túl sok kérés. Várj egy kicsit, és próbáld újra.',
      429,
    );
  }

  const context = await loadVoiceParseContext(deps.strapi, {
    actor,
    features,
    selectedOrganizationId: request.organizationId,
    today: budapestToday(deps.now ? deps.now() : new Date()),
  });

  if (
    request.organizationId &&
    !context.organizations.some((org) => org.id === request.organizationId)
  ) {
    throw new VoiceParseError('Ehhez a szervezethez nincs hozzáférésed.', 403);
  }
  if (context.organizations.length === 0) {
    throw new VoiceParseError('Nincs elérhető szervezeted.', 403);
  }

  if (!deps.llm) {
    throw new VoiceParseError(
      'A hangalapú értelmező nincs beállítva a szerveren.',
      503,
    );
  }

  let raw: unknown;
  try {
    raw = await deps.llm.generateJson({
      system: buildVoiceSystemPrompt(context),
      user: buildVoiceUserMessage(request.transcript),
      schema: VOICE_PARSE_JSON_SCHEMA,
    });
  } catch (error) {
    if (error instanceof LlmError) {
      throw new VoiceParseError(
        'Az értelmező most nem érhető el. Próbáld újra később.',
        502,
      );
    }
    throw error;
  }

  return validateVoiceParseOutput(raw, context, request.transcript);
}
