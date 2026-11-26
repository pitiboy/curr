import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { claimSourceForConvert } from './convert-claim.ts';
import type { ConvertStrapi } from './convert-service.ts';

describe('claimSourceForConvert', () => {
  it('calls db.transaction with db as this (connection binding)', async () => {
    let seenThis: unknown;
    const db = {
      query: () => ({
        updateMany: async () => ({ count: 1 }),
        findOne: async () => null,
      }),
      async transaction<T>(this: unknown, task: () => Promise<T>): Promise<T> {
        seenThis = this;
        // Mimic Strapi Database.transaction: needs `this.connection`.
        assert.ok(
          this && typeof this === 'object' && 'query' in (this as object),
          'transaction must run with db as this',
        );
        return task();
      },
    };

    const strapi = { db } as unknown as ConvertStrapi;
    await claimSourceForConvert(strapi, 'tx-1');
    assert.equal(seenThis, db);
  });
});
