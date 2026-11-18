/**
 * Provider-agnostic LLM boundary. The voice parser only needs "system prompt +
 * user text in, JSON matching a schema out". Each provider lives in its own
 * module (`llm-anthropic.ts`) and is picked by `LLM_PROVIDER`.
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
export const DEFAULT_LLM_MODEL = 'claude-opus-5-5';
export const DEFAULT_LLM_TIMEOUT_MS = 30_000;

/** `null` when no key is configured (the endpoint then answers 503). */
export function readLlmEnv(
  env: Record<string, string | undefined> = process.env,
): LlmEnv | null {
  const apiKey = env.LLM_API_KEY?.trim() ?? '';
  if (!apiKey) return null;
  const timeout = Number.parseInt(env.LLM_TIMEOUT_MS ?? '', 10);
  return {
    provider: (env.LLM_PROVIDER?.trim() || DEFAULT_LLM_PROVIDER).toLowerCase(),
    apiKey,
    model: env.LLM_MODEL?.trim() || DEFAULT_LLM_MODEL,
    timeoutMs:
      Number.isFinite(timeout) && timeout > 0
        ? timeout
        : DEFAULT_LLM_TIMEOUT_MS,
  };
}
