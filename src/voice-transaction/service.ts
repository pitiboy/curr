import { rolesFromFeatureConfig } from '../backoffice-features/parse';
import type { BackofficeFeatureRow } from '../backoffice-features/types';
import { loadVoiceEggParseContext } from './context-egg';
import { loadVoiceParseContext, type VoiceContextStrapi } from './context';
import { LlmError, type LlmJsonClient } from './llm';
import {
  buildVoiceEggSystemPrompt,
  VOICE_EGG_PARSE_JSON_SCHEMA,
} from './prompt-egg';
import {
  buildVoiceSystemPrompt,
  buildVoiceUserMessage,
  VOICE_PARSE_JSON_SCHEMA,
} from './prompt';
import type { RateLimiter } from './rate-limit';
import {
  VOICE_EGG_WORKFLOW_ID,
  VOICE_SUPPORTED_WORKFLOW_IDS,
  VOICE_TRANSACTION_FEATURE_KEY,
  VOICE_TRANSCRIPT_MAX_LENGTH,
  VoiceParseError,
  type VoiceActor,
  type VoiceParseResponse,
  type VoiceSupportedWorkflowId,
} from './types';
import { validateVoiceEggParseOutput } from './validate-egg';
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
  /** When set (e.g. egg-production), uses the bulk voice schema. */
  workflowId: VoiceSupportedWorkflowId | null;
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

function isSupportedWorkflowId(
  value: string,
): value is VoiceSupportedWorkflowId {
  return (VOICE_SUPPORTED_WORKFLOW_IDS as readonly string[]).includes(value);
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
  const rawWorkflow = record.workflowId;
  let workflowId: VoiceSupportedWorkflowId | null = null;
  if (typeof rawWorkflow === 'string' && rawWorkflow.trim()) {
    const trimmed = rawWorkflow.trim();
    if (!isSupportedWorkflowId(trimmed)) {
      throw new VoiceParseError(
        `Ismeretlen vagy nem támogatott workflowId: ${trimmed}.`,
        400,
      );
    }
    workflowId = trimmed;
  }
  return { transcript, organizationId, workflowId };
}

function roleAllowed(allowed: readonly string[], role: string): boolean {
  if (allowed.includes(role)) return true;
  return role === 'controller' && allowed.includes('editor');
}

async function assertVoiceAccess(
  deps: VoiceParseDeps,
  actor: VoiceActor,
): Promise<BackofficeFeatureRow[]> {
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
  return features;
}

async function callLlm(
  deps: VoiceParseDeps,
  system: string,
  transcript: string,
  schema: Record<string, unknown>,
): Promise<unknown> {
  if (!deps.llm) {
    throw new VoiceParseError(
      'A hangalapú értelmező nincs beállítva a szerveren.',
      503,
    );
  }
  try {
    return await deps.llm.generateJson({
      system,
      user: buildVoiceUserMessage(transcript),
      schema,
    });
  } catch (error) {
    if (error instanceof LlmError) {
      throw new VoiceParseError(
        'Az értelmező most nem érhető el. Próbáld újra később.',
        502,
        { cause: error },
      );
    }
    throw error;
  }
}

async function parseVoiceEggBulk(
  deps: VoiceParseDeps,
  actor: VoiceActor,
  request: VoiceParseRequest,
  features: BackofficeFeatureRow[],
): Promise<VoiceParseResponse> {
  const eggFeature = features.find((row) => row.key === VOICE_EGG_WORKFLOW_ID);
  if (!eggFeature?.enabled) {
    throw new VoiceParseError('A napi tojás rögzítés nincs bekapcsolva.', 403);
  }

  const today = budapestToday(deps.now ? deps.now() : new Date());
  const context = await loadVoiceEggParseContext(deps.strapi, {
    actor,
    selectedOrganizationId: request.organizationId,
    today,
  });

  const raw = await callLlm(
    deps,
    buildVoiceEggSystemPrompt(context),
    request.transcript,
    VOICE_EGG_PARSE_JSON_SCHEMA,
  );
  return validateVoiceEggParseOutput(raw, context);
}

/**
 * Auth → feature flag → role → rate limit → org access → LLM → validation.
 * Never writes anything. With `workflowId: egg-production` returns bulk rows.
 */
export async function parseVoiceTransaction(
  deps: VoiceParseDeps,
  actor: VoiceActor | null,
  request: VoiceParseRequest,
): Promise<VoiceParseResponse> {
  if (!actor) {
    throw new VoiceParseError('Bejelentkezés szükséges.', 401);
  }

  const features = await assertVoiceAccess(deps, actor);

  if (request.workflowId === VOICE_EGG_WORKFLOW_ID) {
    return parseVoiceEggBulk(deps, actor, request, features);
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

  const raw = await callLlm(
    deps,
    buildVoiceSystemPrompt(context),
    request.transcript,
    VOICE_PARSE_JSON_SCHEMA,
  );

  return validateVoiceParseOutput(raw, context, request.transcript);
}
