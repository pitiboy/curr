import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { transactionsFilter } from './receipt-transactions';

describe('transactionsFilter', () => {
  it('scopes receipts by linked transaction documentId', () => {
    assert.deepEqual(transactionsFilter('tx-abc'), {
      transactions: { documentId: { $eq: 'tx-abc' } },
    });
  });
});
