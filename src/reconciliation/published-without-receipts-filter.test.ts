import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  accountFilterIsActive,
  matchesPublishedWithoutReceiptsAccountFilter,
  normalizePublishedWithoutReceiptsAccountFilter,
  publishedWithoutReceiptsFilterFromConfig,
  transactionMatchesPublishedWithoutReceiptsFilter,
} from './published-without-receipts-filter.ts';

const KOR_SEED_FILTER = {
  debitCodes: ['5000', '54*'],
  creditCodes: ['1100', '1000', '1001'],
  excludeCurrencyCodes: ['KOR'],
};

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
        rules: [],
        excludeCurrencyCodes: [],
      },
    );
  });

  it('parses flat seed config as a single AND rule', () => {
    assert.deepEqual(
      publishedWithoutReceiptsFilterFromConfig({
        roles: ['controller'],
        publishedWithoutReceipts: KOR_SEED_FILTER,
      }),
      {
        rules: [
          {
            debitCodes: ['5000', '54*'],
            creditCodes: ['1100', '1000', '1001'],
          },
        ],
        excludeCurrencyCodes: ['KOR'],
      },
    );
  });

  it('requires expense debit and liquid credit together', () => {
    const filter = publishedWithoutReceiptsFilterFromConfig({
      publishedWithoutReceipts: KOR_SEED_FILTER,
    });

    // Vendor payment from bank / cash / Homály — keep.
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter(
        '5400',
        '1100',
        filter,
        'HUF',
      ),
      true,
    );
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter(
        '5000',
        '1000',
        filter,
        'HUF',
      ),
      true,
    );
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter(
        '5410',
        '1001',
        filter,
        'HUF',
      ),
      true,
    );

    // Membership / lock legs from the screenshot — drop.
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter(
        '1101',
        '3000',
        filter,
        'HUF',
      ),
      false,
    );
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter(
        '1100',
        '1101',
        filter,
        'HUF',
      ),
      false,
    );
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter(
        '1900',
        '5400',
        filter,
        'HUF',
      ),
      false,
    );
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter(
        '1101',
        '1900',
        filter,
        'KOR',
      ),
      false,
    );
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter(
        '5400',
        '1101',
        filter,
        'KOR',
      ),
      false,
    );
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter(
        '5400',
        '1101',
        filter,
        'HUF',
      ),
      false,
    );

    // Bank alone without expense debit — drop.
    assert.equal(
      matchesPublishedWithoutReceiptsAccountFilter(
        '1001',
        '1100',
        filter,
        'HUF',
      ),
      false,
    );
  });

  it('reads currency_type from the transaction row', () => {
    const filter = publishedWithoutReceiptsFilterFromConfig({
      publishedWithoutReceipts: KOR_SEED_FILTER,
    });
    assert.equal(
      transactionMatchesPublishedWithoutReceiptsFilter(
        {
          debit_account: { code: '5400' },
          credit_account: { code: '1100' },
          currency_type: { code: 'HUF' },
        },
        filter,
      ),
      true,
    );
    assert.equal(
      transactionMatchesPublishedWithoutReceiptsFilter(
        {
          debit_account: { code: '5400' },
          credit_account: { code: '1001' },
          currency_type: { code: 'KOR' },
        },
        filter,
      ),
      false,
    );
  });
});
