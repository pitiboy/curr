import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createLlmClientFromEnv } from './llm-factory';
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_GEMINI_MODEL,
  defaultModelForProvider,
  readLlmEnv,
} from './llm';

describe('readLlmEnv', () => {
  it('returns null without an API key', () => {
    assert.equal(readLlmEnv({}), null);
    assert.equal(readLlmEnv({ LLM_API_KEY: '  ' }), null);
  });

  it('defaults to anthropic + Claude model', () => {
    const env = readLlmEnv({ LLM_API_KEY: 'sk-ant-test' });
    assert.deepEqual(env, {
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      model: DEFAULT_ANTHROPIC_MODEL,
      timeoutMs: 60_000,
    });
  });

  it('picks the Gemini Flash default when provider is gemini', () => {
    const env = readLlmEnv({
      LLM_PROVIDER: 'gemini',
      LLM_API_KEY: 'AIza-test',
    });
    assert.equal(env?.provider, 'gemini');
    assert.equal(env?.model, DEFAULT_GEMINI_MODEL);
  });

  it('honours an explicit model and timeout', () => {
    const env = readLlmEnv({
      LLM_PROVIDER: 'gemini',
      LLM_API_KEY: 'AIza-test',
      LLM_MODEL: 'gemini-3.5-flash',
      LLM_TIMEOUT_MS: '15000',
    });
    assert.equal(env?.model, 'gemini-3.5-flash');
    assert.equal(env?.timeoutMs, 15_000);
  });

  it('defaults timeout to 60s', () => {
    const env = readLlmEnv({ LLM_API_KEY: 'sk-ant-test' });
    assert.equal(env?.timeoutMs, 60_000);
  });
});

describe('defaultModelForProvider', () => {
  it('maps known providers', () => {
    assert.equal(defaultModelForProvider('gemini'), DEFAULT_GEMINI_MODEL);
    assert.equal(defaultModelForProvider('anthropic'), DEFAULT_ANTHROPIC_MODEL);
    assert.equal(defaultModelForProvider('unknown'), DEFAULT_ANTHROPIC_MODEL);
  });
});

describe('createLlmClientFromEnv', () => {
  it('returns null for missing key or unknown provider', () => {
    assert.equal(createLlmClientFromEnv({}), null);
    assert.equal(
      createLlmClientFromEnv({
        LLM_PROVIDER: 'openai',
        LLM_API_KEY: 'sk-test',
      }),
      null,
    );
  });

  it('builds anthropic and gemini clients', () => {
    const anthropic = createLlmClientFromEnv({
      LLM_PROVIDER: 'anthropic',
      LLM_API_KEY: 'sk-ant-test',
    });
    const gemini = createLlmClientFromEnv({
      LLM_PROVIDER: 'gemini',
      LLM_API_KEY: 'AIza-test',
    });
    assert.ok(anthropic);
    assert.ok(gemini);
    assert.equal(typeof anthropic?.generateJson, 'function');
    assert.equal(typeof gemini?.generateJson, 'function');
  });
});
