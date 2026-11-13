import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  accountFilterIsActive,
  matchesPublishedWithoutReceiptsAccountFilter,
  normalizePublishedWithoutReceiptsAccountFilter,
  publishedWithoutReceiptsFilterFromConfig,
  transactionMatchesPublishedWithoutReceiptsFilter,
} from './published-without-receipts-filter.ts';

describe('publishedWithoutReceiptsFilter', () => {
  it('tolerates undefined filter without throwing', () => {
    assert.equal(accountFilterIsActive(undefined), false);
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter('5000', '1100', undefined),
      true,
    );
    assert.deepEqual(
      normalizePublishedWithoutReceiptsAccountFilter(undefined),
      {
        creditCodes: [],
        debitCodes: [],
      },
    );
  });

  it('parses seed-shaped config', () => {
    assert.deepEqual(
      publishedWithoutReceiptsFilterFromConfig({
        roles: ['controller'],
        publishedWithoutReceipts: {
          creditCodes: ['1100'],
          debitCodes: ['5000', '54*'],
        },
      }),
      { creditCodes: ['1100'], debitCodes: ['5000', '54*'] },
    );
  });

  it('matches bank credit or material/service debit', () => {
    const filter = {
      creditCodes: ['1100'],
      debitCodes: ['5000', '54*'],
    };
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter('1510', '1100', filter),
      true,
    );
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter('5000', '1000', filter),
      true,
    );
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter('5410', '1001', filter),
      true,
    );
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter('5100', '1000', filter),
      false,
    );
    assert.equal(
      transactionMatchesPublishedWithoutReceiptsFilter(
        {
          debit_account: { code: '4000' },
          credit_account: { code: '1001' },
        },
        filter,
      ),
      false,
    );
  });
});
