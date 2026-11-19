import { createAnthropicLlmClient } from './llm-anthropic';
import { createGeminiLlmClient } from './llm-gemini';
import { readLlmEnv, type LlmJsonClient } from './llm';

/**
 * Builds the configured client, or `null` when `LLM_API_KEY` is missing or
 * `LLM_PROVIDER` names a provider without an adapter. Add new providers here.
 */
export function createLlmClientFromEnv(
  env: Record<string, string | undefined> = process.env,
): LlmJsonClient | null {
  const config = readLlmEnv(env);
  if (!config) return null;
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicLlmClient(config);
    case 'gemini':
      return createGeminiLlmClient(config);
    default:
      return null;
  }
}
