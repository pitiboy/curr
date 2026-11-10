import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readAuditConfig } from './config.ts';
import { resolveActor, resolveLoginActor } from './actor.ts';

const alwaysPaths = readAuditConfig({}).alwaysPaths;

describe('resolveActor', () => {
  it('resolves users-permissions, admin, api-token, and anonymous', () => {
    assert.deepEqual(
      resolveActor({
        state: {
          auth: { strategy: { name: 'users-permissions' } },
          user: { id: 7, email: 'u@example.com', role: { type: 'editor' } },
        },
      }),
      {
        type: 'user',
        id: 7,
        label: 'u@example.com',
        role: 'editor',
      },
    );

    assert.deepEqual(
      resolveActor({
        state: {
          auth: { strategy: { name: 'admin' } },
          user: {
            id: 1,
            email: 'admin@example.com',
            roles: [{ code: 'strapi-super-admin' }],
          },
        },
      }),
      {
        type: 'admin',
        id: 1,
        label: 'admin@example.com',
        role: 'strapi-super-admin',
      },
    );

    assert.deepEqual(
      resolveActor({
        state: {
          auth: {
            strategy: { name: 'api-token' },
            credentials: { id: 99, name: 'Importer' },
          } as never,
        },
      }),
      {
        type: 'api-token',
        id: 99,
        label: 'Importer',
        role: null,
      },
    );

    assert.deepEqual(resolveActor({}), { type: 'anonymous' });
  });
});

describe('resolveLoginActor', () => {
  it('enriches failed and successful login on always paths', () => {
    const failed = resolveLoginActor(
      {},
      '/api/auth/local',
      { identifier: 'user@example.com', password: 'x' },
      alwaysPaths,
      400,
    );
    assert.deepEqual(failed, {
      type: 'anonymous',
      id: null,
      label: 'user@example.com',
      role: null,
    });

    const success = resolveLoginActor(
      {
        body: { data: { user: { id: 42 } }, jwt: 'hidden' },
      },
      '/admin/login',
      { email: 'admin@example.com', password: 'ok' },
      alwaysPaths,
      200,
    );
    assert.deepEqual(success, {
      type: 'anonymous',
      id: 42,
      label: 'admin@example.com',
      role: null,
    });
  });
});
