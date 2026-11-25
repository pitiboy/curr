/**
 * egg-production/distribution.ts + membership-rules.ts (moved from the
 * backoffice bulk-quantity module; the SPA imports these for display only).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isOverDistributed,
  memberNeedsSaleRate,
  membershipValidOnDate,
  parsePositiveQuantity,
  pickLatestCurrencyRate,
  remainingEggs,
  saleRevenueAmount,
  totalDistributed,
  totalProduced,
} from './distribution.ts';
import { parseEggRule, resolveEggRule } from './membership-rules.ts';

describe('distribution totals', () => {
  it('computes produced, distributed and remaining', () => {
    assert.equal(totalProduced([{ amount: 10 }, { amount: 5 }]), 15);
    assert.equal(
      totalDistributed({ m1: 3, m2: '', m3: 1.5 }, ['m1', 'm2', 'm3']),
      3,
    );
    assert.equal(remainingEggs(15, 3), 12);
    assert.equal(isOverDistributed(10, 11), true);
    assert.equal(parsePositiveQuantity('0'), null);
    assert.equal(parsePositiveQuantity(' 7 '), 7);
  });

  it('rounds sale revenue to 4 decimals', () => {
    assert.equal(saleRevenueAmount(10, 0.75, 60), 450);
    assert.equal(saleRevenueAmount(3, 0.5, 33.333), 49.9995);
  });

  it('checks membership validity on the inclusive UTC day', () => {
    assert.equal(
      membershipValidOnDate('2026-11-18T23:00:00.000Z', null, '2026-11-18'),
      true,
    );
    assert.equal(
      membershipValidOnDate('2026-11-19T00:00:00.000Z', null, '2026-11-18'),
      false,
    );
    assert.equal(
      membershipValidOnDate(null, '2026-11-17T23:59:59.000Z', '2026-11-18'),
      false,
    );
  });
});

describe('membership egg rules', () => {
  it('defaults missing rules to sale ratio 1', () => {
    assert.deepEqual(parseEggRule(null), { mode: 'sale', ratio: 1 });
  });

  it('membership override wins over type rules, then type name fallback', () => {
    assert.deepEqual(
      resolveEggRule(
        { egg: { mode: 'internal', ratio: 1 } },
        { egg: { mode: 'sale', ratio: 99 } },
      ),
      { mode: 'internal', ratio: 1 },
    );
    assert.deepEqual(
      resolveEggRule(null, { egg: { mode: 'sale', ratio: 0.5 } }),
      {
        mode: 'sale',
        ratio: 0.5,
      },
    );
    assert.deepEqual(resolveEggRule(null, {}, 'Bentlakó tag'), {
      mode: 'internal',
      ratio: 1,
    });
    assert.deepEqual(resolveEggRule(null, null, 'Érdeklődő'), {
      mode: 'sale',
      ratio: 0.75,
    });
  });

  it('needs a sale rate only when a member sells', () => {
    const internal = {
      membershipTypeName: 'Bentlakó tag',
      membershipRules: null,
      membershipTypeRules: null,
    };
    const sale = { ...internal, membershipTypeName: 'Vásárló' };
    assert.equal(memberNeedsSaleRate([internal]), false);
    assert.equal(memberNeedsSaleRate([internal, sale]), true);
  });
});

describe('pickLatestCurrencyRate', () => {
  const rates = [
    {
      rate: 50,
      validFrom: '2026-01-01T00:00:00.000Z',
      fromCurrencyCode: 'EGG',
      toCurrencyCode: 'HUF',
    },
    {
      rate: 60,
      validFrom: '2026-11-18T12:00:00.000Z',
      fromCurrencyCode: 'EGG',
      toCurrencyCode: 'HUF',
    },
    {
      rate: 70,
      validFrom: '2026-11-19T00:00:00.000Z',
      fromCurrencyCode: 'EGG',
      toCurrencyCode: 'HUF',
    },
  ];

  it('picks the latest rate on or before the form date', () => {
    assert.equal(
      pickLatestCurrencyRate(rates, 'EGG', 'HUF', '2026-11-18')?.rate,
      60,
    );
    assert.equal(
      pickLatestCurrencyRate(rates, 'EGG', 'HUF', '2025-12-31'),
      null,
    );
  });

  it('uses 1 when currencies match', () => {
    assert.equal(
      pickLatestCurrencyRate([], 'HUF', 'HUF', '2026-11-18')?.rate,
      1,
    );
  });
});
