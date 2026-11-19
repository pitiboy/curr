import { ApiError, GoogleGenAI } from '@google/genai';

import {
  LlmError,
  type LlmEnv,
  type LlmJsonClient,
  type LlmJsonRequest,
} from './llm';

/** Gemini API (Google AI Studio) with JSON schema structured output. */
export function createGeminiLlmClient(env: LlmEnv): LlmJsonClient {
  const client = new GoogleGenAI({
    apiKey: env.apiKey,
    httpOptions: { timeout: env.timeoutMs },
  });

  return {
    async generateJson(request: LlmJsonRequest): Promise<unknown> {
      let response;
      try {
        response = await client.models.generateContent({
          model: env.model,
          contents: request.user,
          config: {
            systemInstruction: request.system,
            responseMimeType: 'application/json',
            responseJsonSchema: request.schema,
            httpOptions: { timeout: env.timeoutMs },
          },
        });
      } catch (error) {
        if (error instanceof ApiError) {
          throw new LlmError(`LLM request failed (status ${error.status})`);
        }
        throw new LlmError('LLM request failed');
      }

      const text = response.text?.trim() ?? '';
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
