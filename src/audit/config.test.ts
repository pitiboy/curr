import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isInvalidAuditSink, readAuditConfig, shouldAudit } from './config.ts';

describe('readAuditConfig', () => {
  it('applies defaults for empty env', () => {
    const cfg = readAuditConfig({});
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.sink, 'both');
    assert.deepEqual([...cfg.methods], ['POST', 'PUT', 'PATCH', 'DELETE']);
    assert.equal(cfg.includeBody, true);
    assert.equal(cfg.maxBodyBytes, 8192);
    assert.equal(cfg.retentionDays, 365);
    assert.equal(cfg.redactKeys.has('password'), true);
    assert.equal(cfg.alwaysPaths.has('/api/auth/local'), true);
  });

  it('parses custom comma lists and booleans', () => {
    const cfg = readAuditConfig({
      AUDIT_LOG_ENABLED: 'false',
      AUDIT_LOG_METHODS: ' GET , post ',
      AUDIT_LOG_PATH_PREFIXES: '/api/',
      AUDIT_LOG_ALWAYS_PATHS: '/admin/login',
      AUDIT_LOG_REDACT_KEYS: 'Password, TOKEN ',
    });
    assert.equal(cfg.enabled, false);
    assert.deepEqual([...cfg.methods].sort(), ['GET', 'POST']);
    assert.deepEqual(cfg.pathPrefixes, ['/api/']);
    assert.equal(cfg.alwaysPaths.has('/admin/login'), true);
    assert.equal(cfg.redactKeys.has('password'), true);
    assert.equal(cfg.redactKeys.has('token'), true);
  });

  it('falls back sink to both for invalid values', () => {
    const cfg = readAuditConfig({ AUDIT_LOG_SINK: 'nope' });
    assert.equal(cfg.sink, 'both');
    assert.equal(isInvalidAuditSink({ AUDIT_LOG_SINK: 'nope' }), true);
    assert.equal(isInvalidAuditSink({}), false);
  });
});

describe('shouldAudit', () => {
  const cfg = readAuditConfig({});

  it('audits write methods under configured prefixes', () => {
    assert.equal(
      shouldAudit(
        cfg,
        'DELETE',
        '/content-manager/collection-types/api::x.x/1',
      ),
      true,
    );
    assert.equal(shouldAudit(cfg, 'POST', '/api/transactions'), true);
  });

  it('does not audit GET except on always paths', () => {
    assert.equal(shouldAudit(cfg, 'GET', '/api/auth/google/callback'), true);
    assert.equal(shouldAudit(cfg, 'GET', '/api/transactions'), false);
  });

  it('excludes health and token renewal paths', () => {
    assert.equal(shouldAudit(cfg, 'POST', '/_health'), false);
    assert.equal(shouldAudit(cfg, 'POST', '/admin/renew-token'), false);
  });

  it('respects disabled config', () => {
    const off = readAuditConfig({ AUDIT_LOG_ENABLED: 'false' });
    assert.equal(shouldAudit(off, 'POST', '/api/auth/local'), false);
  });
});
