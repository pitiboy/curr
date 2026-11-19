import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { errors } from '@strapi/utils';

import { assertValidAssetData, registerAssetGuard } from './asset-guard.ts';

const isValidation = (e: unknown) => e instanceof errors.ValidationError;

describe('assertValidAssetData', () => {
  it('accepts a minimal valid create payload', () => {
    assert.doesNotThrow(() =>
      assertValidAssetData(
        { name: 'Traktor', organization: 'org-a' },
        { creating: true },
      ),
    );
  });

  it('rejects unknown ownership_type and status values', () => {
    assert.throws(
      () =>
        assertValidAssetData(
          { organization: 'org-a', ownership_type: 'rented' },
          { creating: true },
        ),
      isValidation,
    );
    assert.throws(
      () =>
        assertValidAssetData(
          { organization: 'org-a', status: 'lost' },
          { creating: true },
        ),
      isValidation,
    );
  });

  it('accepts every enum value from the schema', () => {
    for (const ownership_type of [
      'coop_owned',
      'member_owned_lendable',
      'barter',
    ]) {
      for (const status of [
        'in_use',
        'in_storage',
        'under_repair',
        'lent_out',
        'disposed',
      ]) {
        assert.doesNotThrow(() =>
          assertValidAssetData({ ownership_type, status }, { creating: false }),
        );
      }
    }
  });

  it('requires organization on create and forbids clearing it on update', () => {
    assert.throws(
      () => assertValidAssetData({ name: 'x' }, { creating: true }),
      isValidation,
    );
    assert.throws(
      () => assertValidAssetData({ organization: null }, { creating: false }),
      isValidation,
    );
    assert.doesNotThrow(() =>
      assertValidAssetData({ name: 'y' }, { creating: false }),
    );
  });

  it('rejects a negative purchase price', () => {
    assert.throws(
      () =>
        assertValidAssetData(
          { organization: 'org-a', purchase_price: -1 },
          { creating: true },
        ),
      isValidation,
    );
  });
});

describe('registerAssetGuard', () => {
  it('only guards asset create/update', async () => {
    let middleware:
      | ((
          ctx: {
            uid: string;
            action: string;
            params?: Record<string, unknown>;
          },
          next: () => Promise<unknown>,
        ) => Promise<unknown>)
      | null = null;
    registerAssetGuard({
      documents: {
        use: (fn) => {
          middleware = fn;
        },
      },
    });
    assert.ok(middleware);
    const run = middleware as NonNullable<typeof middleware>;
    assert.equal(
      await run(
        { uid: 'api::transaction.transaction', action: 'create', params: {} },
        async () => 'ok',
      ),
      'ok',
    );
    await assert.rejects(
      () =>
        run(
          { uid: 'api::asset.asset', action: 'create', params: { data: {} } },
          async () => 'ok',
        ),
      isValidation,
    );
  });
});
