import { describe, expect, it } from 'vitest';

import {
  buildDistributionLegs,
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
    expect(pickLatestCurrencyRate(rates, 'EGG', 'HUF', '2026-10-01')?.rate).toBe(
      200,
    );
    expect(pickLatestCurrencyRate(rates, 'EGG', 'HUF', '2026-03-01')?.rate).toBe(
      100,
    );
    expect(pickLatestCurrencyRate(rates, 'EGG', 'EUR', '2026-10-01')).toBeNull();
  });

  it('uses 1 when currencies match', () => {
    expect(pickLatestCurrencyRate([], 'HUF', 'HUF', '2026-10-01')?.rate).toBe(1);
  });
});

describe('distribution legs', () => {
  const refs = {
    bookingOrganizationId: 'org-poultry',
    eggCurrencyTypeId: 'cur-egg',
    saleCurrencyTypeId: 'cur-huf',
    inventoryAccountId: 'acc-1300',
    saleExpenseAccountId: 'acc-5600',
    revenueAccountId: 'acc-4000',
    internalTransactionTypeId: 'type-atv',
    saleStockTransactionTypeId: 'type-atv',
    saleRevenueTransactionTypeId: 'type-atv',
  };

  it('builds internal and sale legs', () => {
    const legs = buildDistributionLegs({
      rows: [
        {
          memberId: 'm1',
          memberName: 'Anna',
          amount: 4,
          eggRule: { mode: 'internal', ratio: 1 },
          memberAccountId: 'acc-private',
        },
        {
          memberId: 'm2',
          memberName: 'Béla',
          amount: 2,
          eggRule: { mode: 'sale', ratio: 1 },
          memberAccountId: 'acc-tag',
        },
      ],
      bookingOrganizationId: refs.bookingOrganizationId,
      eggCurrencyTypeId: refs.eggCurrencyTypeId,
      saleCurrencyTypeId: refs.saleCurrencyTypeId,
      inventoryAccountId: refs.inventoryAccountId,
      saleExpenseAccountId: refs.saleExpenseAccountId,
      revenueAccountId: refs.revenueAccountId,
      internalTransactionTypeId: refs.internalTransactionTypeId,
      saleStockTransactionTypeId: refs.saleStockTransactionTypeId,
      saleRevenueTransactionTypeId: refs.saleRevenueTransactionTypeId,
      eggToSaleRate: 200,
      internalMemberAccountIdForRow: () => 'acc-private',
      saleMemberAccountIdForRow: () => 'acc-tag',
    });
    expect(legs).toHaveLength(3);
    expect(legs[0]).toMatchObject({
      legKey: 'm1:internal',
      amount: 4,
      debitAccountId: 'acc-private',
      creditAccountId: 'acc-1300',
    });
    expect(saleRevenueAmount(2, 1, 200)).toBe(400);
  });
});
