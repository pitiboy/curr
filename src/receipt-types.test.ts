import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RECEIPT_TYPE_NAMES, ensureReceiptTypes } from './receipt-types.ts';

describe('ensureReceiptTypes', () => {
  it('creates only the names that are not already stored', async () => {
    const created: string[] = [];
    await ensureReceiptTypes({
      documents: () => ({
        findMany: async () => [{ name: RECEIPT_TYPE_NAMES[0] }],
        create: async ({ data }) => {
          created.push(data.name);
        },
      }),
      log: { info() {} },
    });

    assert.equal(created.length, RECEIPT_TYPE_NAMES.length - 1);
    assert.equal(created.includes(RECEIPT_TYPE_NAMES[0]), false);
    assert.deepEqual(created, RECEIPT_TYPE_NAMES.slice(1));
  });
});
