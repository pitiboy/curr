/**
 * Provider-agnostic LLM boundary. The voice parser only needs "system prompt +
 * user text in, JSON matching a schema out". Each provider lives in its own
 * module (`llm-anthropic.ts`, `llm-gemini.ts`) and is picked by `LLM_PROVIDER`.
 *
 * The API key is read on the server only and never sent to the client.
 */

export type LlmJsonRequest = {
  system: string;
  user: string;
  /** JSON Schema the response must satisfy (structured output). */
  schema: Record<string, unknown>;
};

export interface LlmJsonClient {
  /** Returns the parsed JSON value. Throws {@link LlmError} on failure. */
  generateJson(request: LlmJsonRequest): Promise<unknown>;
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmError';
  }
}

export type LlmEnv = {
  provider: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

export const DEFAULT_LLM_PROVIDER = 'anthropic';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';
/** Free-tier friendly Flash model on Google AI Studio. */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_LLM_TIMEOUT_MS = 30_000;

/** Kept for callers that still import the old name. */
export const DEFAULT_LLM_MODEL = DEFAULT_ANTHROPIC_MODEL;

export function defaultModelForProvider(provider: string): string {
  switch (provider) {
    case 'gemini':
      return DEFAULT_GEMINI_MODEL;
    case 'anthropic':
    default:
      return DEFAULT_ANTHROPIC_MODEL;
  }
}

/** `null` when no key is configured (the endpoint then answers 503). */
export function readLlmEnv(
  env: Record<string, string | undefined> = process.env,
): LlmEnv | null {
  const apiKey = env.LLM_API_KEY?.trim() ?? '';
  if (!apiKey) return null;
  const timeout = Number.parseInt(env.LLM_TIMEOUT_MS ?? '', 10);
  const provider = (
    env.LLM_PROVIDER?.trim() || DEFAULT_LLM_PROVIDER
  ).toLowerCase();
  return {
    provider,
    apiKey,
    model: env.LLM_MODEL?.trim() || defaultModelForProvider(provider),
    timeoutMs:
      Number.isFinite(timeout) && timeout > 0
        ? timeout
        : DEFAULT_LLM_TIMEOUT_MS,
  };
}
