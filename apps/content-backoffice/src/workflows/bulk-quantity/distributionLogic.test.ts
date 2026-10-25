import { describe, expect, it } from 'vitest';

import {
  buildDistributionLegs,
  distributionRowsFromQuantities,
  isOverDistributed,
  pickLatestCurrencyRate,
  remainingEggs,
  saleRevenueAmount,
  totalDistributed,
  totalProduced,
} from './distributionLogic';
import { parseEggRule, resolveEggRule } from './membershipRules';

describe('distribution totals', () => {
  it('computes produced, distributed, and remaining', () => {
    expect(
      totalProduced([
        { organizationId: 'a', organizationName: 'A', amount: 10 },
        { organizationId: 'b', organizationName: 'B', amount: 5 },
      ]),
    ).toBe(15);
    expect(totalDistributed({ m1: 3, m2: '' }, ['m1', 'm2'])).toBe(3);
    expect(remainingEggs(15, 3)).toBe(12);
    expect(isOverDistributed(10, 11)).toBe(true);
  });
});

describe('membership egg rules', () => {
  it('defaults missing rules to sale ratio 1', () => {
    expect(parseEggRule(null)).toEqual({ mode: 'sale', ratio: 1 });
  });

  it('prefers membership override over type defaults', () => {
    expect(
      resolveEggRule(
        { egg: { mode: 'internal', ratio: 1 } },
        { egg: { mode: 'sale', ratio: 99 } },
      ),
    ).toEqual({ mode: 'internal', ratio: 1 });
  });

  it('uses internal for bentlakó when type rules JSON is empty', () => {
    expect(resolveEggRule(null, null, 'Bentlakó tag')).toEqual({
      mode: 'internal',
      ratio: 1,
    });
  });

  it('resolves egg mode from membership type name in distribution rows', () => {
    const rows = distributionRowsFromQuantities(
      [
        {
          memberId: 'm1',
          memberName: 'Laci',
          membershipTypeName: 'Bentlakó tag',
          membershipRules: null,
          membershipTypeRules: null,
          memberAccountId: null,
        },
      ],
      { m1: 5 },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eggRule).toEqual({ mode: 'internal', ratio: 1 });
  });
});

describe('currency rate pick', () => {
  const rates = [
    {
      rate: 100,
      validFrom: '2026-01-01T00:00:00.000Z',
      fromCurrencyCode: 'EGG',
      toCurrencyCode: 'HUF',
    },
    {
      rate: 200,
      validFrom: '2026-06-01T00:00:00.000Z',
      fromCurrencyCode: 'EGG',
      toCurrencyCode: 'HUF',
    },
  ];

  it('picks the latest rate on or before the form date', () => {
    expect(
      pickLatestCurrencyRate(rates, 'EGG', 'HUF', '2026-10-01')?.rate,
    ).toBe(200);
    expect(
      pickLatestCurrencyRate(rates, 'EGG', 'HUF', '2026-03-01')?.rate,
    ).toBe(100);
    expect(
      pickLatestCurrencyRate(rates, 'EGG', 'EUR', '2026-10-01'),
    ).toBeNull();
  });

  it('uses 1 when currencies match', () => {
    expect(pickLatestCurrencyRate([], 'HUF', 'HUF', '2026-10-01')?.rate).toBe(
      1,
    );
  });
});

describe('distribution legs', () => {
  const baseInput = {
    bookingOrganizationId: 'org-poultry',
    eggCurrencyTypeId: 'cur-egg',
    saleCurrencyTypeId: 'cur-huf',
    inventoryAccountId: 'acc-1300',
    saleCashAccountId: 'acc-1000',
    revenueAccountId: 'acc-4000',
    internalTransactionTypeId: 'type-atv',
    saleEggTransactionTypeId: 'type-atv',
    saleCashPaymentTransactionTypeId: 'type-cash',
    saleRevenueTransactionTypeId: 'type-atv',
    memberPrivateAccountIdForRow: () => 'acc-1001-member',
    eggToSaleRate: 200,
  };

  it('builds internal and sale legs', () => {
    const legs = buildDistributionLegs({
      ...baseInput,
      rows: [
        {
          memberId: 'm1',
          memberName: 'Anna',
          amount: 4,
          eggRule: { mode: 'internal', ratio: 1 },
          memberAccountId: 'acc-1001-member',
        },
        {
          memberId: 'm2',
          memberName: 'Béla',
          amount: 2,
          eggRule: { mode: 'sale', ratio: 1 },
          memberAccountId: 'acc-1001-member',
        },
      ],
    });
    expect(legs).toHaveLength(4);
    expect(legs[0]).toMatchObject({
      legKey: 'm1:internal',
      amount: 4,
      debitAccountId: 'acc-1001-member',
      creditAccountId: 'acc-1300',
    });
    expect(legs[1]).toMatchObject({
      legKey: 'm2:egg',
      amount: 2,
      currencyTypeId: 'cur-egg',
      debitAccountId: 'acc-1001-member',
      creditAccountId: 'acc-1300',
    });
    expect(legs[2]).toMatchObject({
      legKey: 'm2:cash',
      amount: 400,
      debitAccountId: 'acc-1000',
      creditAccountId: 'acc-1001-member',
      transactionTypeId: 'type-cash',
    });
    expect(legs[3]).toMatchObject({
      legKey: 'm2:revenue',
      amount: 400,
      debitAccountId: 'acc-4000',
      creditAccountId: 'acc-1000',
    });
    expect(saleRevenueAmount(2, 1, 200)).toBe(400);
  });
});
