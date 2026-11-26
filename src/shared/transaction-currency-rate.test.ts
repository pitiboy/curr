/**
 * Közös árfolyam-dátum szabály (#109): backend és backoffice azonos választója.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatCurrencyRateMissingMessage,
  pickDirectRateAtTransactionDate,
  pickRateAtTransactionDate,
  pickRateByCurrencyCodeAtTransactionDate,
  transactionRateCutoff,
  transactionRateIsoDay,
} from './transaction-currency-rate.ts';

const korHuf500 = {
  rate: 500,
  validFrom: '2024-06-01T00:00:00.000Z',
  fromKey: 'cur-kor',
  toKey: 'cur-huf',
  rowKey: 'r-500',
};

const korHuf600 = {
  rate: 600,
  validFrom: '2025-06-01T00:00:00.000Z',
  fromKey: 'cur-kor',
  toKey: 'cur-huf',
  rowKey: 'r-600',
};

const korHufFuture = {
  rate: 900,
  validFrom: '2026-01-01T00:00:00.000Z',
  fromKey: 'cur-kor',
  toKey: 'cur-huf',
  rowKey: 'r-future',
};

describe('transactionRateIsoDay / transactionRateCutoff', () => {
  it('uses the calendar prefix regardless of time offset', () => {
    assert.equal(transactionRateIsoDay('2025-01-01'), '2025-01-01');
    assert.equal(
      transactionRateIsoDay('2025-01-01T00:30:00+01:00'),
      '2025-01-01',
    );
    assert.equal(
      transactionRateIsoDay('2024-12-31T23:30:00+01:00'),
      '2024-12-31',
    );
    assert.equal(
      transactionRateCutoff('2025-01-01'),
      '2025-01-01T22:59:59.999Z',
    );
  });
});

describe('issue #109 KOR → HUF example', () => {
  const history = [korHuf500, korHuf600, korHufFuture];

  it('2025-01-01 transaction uses 500, not 600 or today/future', () => {
    const picked = pickDirectRateAtTransactionDate(
      history,
      'cur-kor',
      'cur-huf',
      '2025-01-01',
    );
    assert.equal(picked?.rate, 500);
    assert.equal(picked?.rowKey, 'r-500');
  });

  it('2025-06-01 transaction uses 600 on rate start day', () => {
    const picked = pickDirectRateAtTransactionDate(
      history,
      'cur-kor',
      'cur-huf',
      '2025-06-01',
    );
    assert.equal(picked?.rate, 600);
  });

  it('day before new rate still uses earlier row', () => {
    const picked = pickDirectRateAtTransactionDate(
      history,
      'cur-kor',
      'cur-huf',
      '2025-05-31',
    );
    assert.equal(picked?.rate, 500);
  });

  it('before first rate → null (CURRENCY_RATE_MISSING)', () => {
    assert.equal(
      pickDirectRateAtTransactionDate(
        history,
        'cur-kor',
        'cur-huf',
        '2024-05-01',
      ),
      null,
    );
  });

  it('HUF → KOR inverts 500 for 2025-01-01', () => {
    const picked = pickRateAtTransactionDate(
      history,
      'cur-huf',
      'cur-kor',
      '2025-01-01',
      { fromCode: 'HUF', toCode: 'KOR' },
    );
    assert.equal(picked?.rate, 1 / 500);
    assert.equal(picked?.inverted, true);
    assert.equal(picked?.validFrom, '2024-06-01T00:00:00.000Z');
  });
});

describe('timezone edge around 2025-01-01', () => {
  const rateJan1 = {
    rate: 100,
    validFrom: '2025-01-01T00:00:00.000Z',
    fromKey: 'a',
    toKey: 'b',
    rowKey: 'jan1',
  };
  const rateDec31 = {
    rate: 90,
    validFrom: '2024-12-30T23:00:00.000Z',
    fromKey: 'a',
    toKey: 'b',
    rowKey: 'dec31',
  };

  it('2025-01-01 Budapest calendar day includes valid_from on that UTC midnight', () => {
    const picked = pickDirectRateAtTransactionDate(
      [rateDec31, rateJan1],
      'a',
      'b',
      '2025-01-01T00:30:00+01:00',
    );
    assert.equal(picked?.rate, 100);
    assert.equal(picked?.rowKey, 'jan1');
  });

  it('2024-12-31 evening Budapest stays on Dec 31 row set', () => {
    const picked = pickDirectRateAtTransactionDate(
      [rateDec31, rateJan1],
      'a',
      'b',
      '2024-12-31T23:30:00+01:00',
    );
    assert.equal(picked?.rate, 90);
    assert.equal(picked?.rowKey, 'dec31');
  });
});

describe('formatCurrencyRateMissingMessage', () => {
  it('returns Hungarian user text with pair and date', () => {
    assert.equal(
      formatCurrencyRateMissingMessage('HUF', 'KOR', '2025-01-01'),
      'Nincs érvényes árfolyam (HUF → KOR) a tranzakció dátumára: 2025-01-01.',
    );
  });
});

describe('pickRateByCurrencyCodeAtTransactionDate (backoffice)', () => {
  const codes = [
    {
      rate: 500,
      validFrom: '2024-06-01T00:00:00.000Z',
      fromCurrencyCode: 'KOR',
      toCurrencyCode: 'HUF',
    },
    {
      rate: 600,
      validFrom: '2025-06-01T00:00:00.000Z',
      fromCurrencyCode: 'KOR',
      toCurrencyCode: 'HUF',
    },
  ];

  it('matches document-id pick for the same inputs', () => {
    const byCode = pickRateByCurrencyCodeAtTransactionDate(
      codes,
      'KOR',
      'HUF',
      '2025-01-01',
    );
    const byId = pickDirectRateAtTransactionDate(
      codes.map((row) => ({
        rate: row.rate,
        validFrom: row.validFrom,
        fromKey: row.fromCurrencyCode,
        toKey: row.toCurrencyCode,
      })),
      'KOR',
      'HUF',
      '2025-01-01',
    );
    assert.equal(byCode?.rate, byId?.rate);
    assert.equal(byCode?.rate, 500);
  });
});

describe('Budapest local-midnight valid_from (CET/CEST)', () => {
  const eggOld = {
    rate: 100,
    validFrom: '2022-12-31T23:00:00.000Z', // 2023-01-01 00:00 Budapest
    fromKey: 'egg',
    toKey: 'huf',
    rowKey: 'old',
  };
  const eggNov1 = {
    rate: 1000,
    validFrom: '2026-10-31T23:00:00.000Z', // 2026-11-01 00:00 Budapest
    fromKey: 'egg',
    toKey: 'huf',
    rowKey: 'nov1',
  };

  it('2026-10-31 transaction does not use the rate valid from 2026-11-01', () => {
    const picked = pickDirectRateAtTransactionDate(
      [eggOld, eggNov1],
      'egg',
      'huf',
      '2026-10-31',
    );
    assert.equal(picked?.rate, 100);
    assert.equal(picked?.rowKey, 'old');
  });

  it('2026-11-01 transaction uses the new rate', () => {
    const picked = pickDirectRateAtTransactionDate(
      [eggOld, eggNov1],
      'egg',
      'huf',
      '2026-11-01',
    );
    assert.equal(picked?.rate, 1000);
  });

  it('summer time: cutoff is 22:00Z the day before the next day', () => {
    assert.equal(
      transactionRateCutoff('2026-07-01'),
      '2026-07-01T21:59:59.999Z',
    );
  });
});
