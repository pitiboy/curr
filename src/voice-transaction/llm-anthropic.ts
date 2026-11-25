import Anthropic from '@anthropic-ai/sdk';

import {
  LlmError,
  type LlmEnv,
  type LlmJsonClient,
  type LlmJsonRequest,
} from './llm';

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set([
  'claude-fable-5-2',
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);

/** Anthropic Messages API with JSON structured output. */
export function createAnthropicLlmClient(env: LlmEnv): LlmJsonClient {
  const client = new Anthropic({
    apiKey: env.apiKey,
    timeout: env.timeoutMs,
    maxRetries: 1,
  });
  const withFallback = FALLBACK_MODELS.has(env.model);

  return {
    async generateJson(request: LlmJsonRequest): Promise<unknown> {
      let response;
      try {
        response = await client.beta.messages.create({
          model: env.model,
          max_tokens: 16000,
          ...(withFallback
            ? {
                betas: ['server-side-fallback-2026-07-01'],
                fallbacks: 'default' as const,
              }
            : {}),
          output_config: {
            // Short extraction task: keep latency low.
            effort: 'low',
            format: { type: 'json_schema', schema: request.schema },
          },
          system: request.system,
          messages: [{ role: 'user', content: request.user }],
        });
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          throw new LlmError(`LLM request failed (status ${error.status})`);
        }
        throw new LlmError('LLM request failed');
      }

      if (response.stop_reason === 'refusal') {
        throw new LlmError('LLM refused the request');
      }
      if (response.stop_reason === 'max_tokens') {
        throw new LlmError('LLM output was truncated');
      }
      const text = response.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('')
        .trim();
      if (!text) {
        throw new LlmError('LLM returned no text');
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new LlmError('LLM returned invalid JSON');
      }
    },
  };
}
