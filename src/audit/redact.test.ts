import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { redact, truncateJson } from './redact.ts';

const keys = new Set(['password', 'token', 'jwt']);

describe('redact', () => {
  it('redacts nested keys case-insensitively and leaves identifier/email', () => {
    const input = {
      identifier: 'user@example.com',
      email: 'user@example.com',
      Password: 'secret',
      nested: { TOKEN: 'abc', keep: 1 },
      list: [{ JWT: 'x' }, { note: 'ok' }],
    };
    const output = redact(input, keys) as Record<string, unknown>;
    assert.equal(output.identifier, 'user@example.com');
    assert.equal(output.email, 'user@example.com');
    assert.equal(output.Password, '[REDACTED]');
    assert.deepEqual(output.nested, { TOKEN: '[REDACTED]', keep: 1 });
    assert.deepEqual(output.list, [{ JWT: '[REDACTED]' }, { note: 'ok' }]);
  });

  it('handles cycles and truncation', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    const redacted = redact(cyclic, keys) as Record<string, unknown>;
    assert.equal(redacted.a, 1);
    assert.equal(redacted.self, '[CYCLE]');

    const big = { x: 'y'.repeat(20) };
    const { value, truncated } = truncateJson(big, 10);
    assert.equal(truncated, true);
    const preview = (value as { preview: string }).preview;
    assert.equal(preview.length, 10);
    assert.equal(preview.startsWith('{"x":"'), true);
  });
});
