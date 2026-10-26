import { resolveEggRule, type EggDistributionRule } from './membershipRules';
import type { BulkQuantityRow } from './types';

export type DistributionMemberRow = {
  memberId: string;
  memberName: string;
  amount: number;
  eggRule: EggDistributionRule;
  memberAccountId: string | null;
};

export type DistributionTransactionLeg = {
  legKey: string;
  organizationId: string;
  memberId: string;
  memberName: string;
  amount: number;
  currencyTypeId: string;
  debitAccountId: string;
  creditAccountId: string;
  transactionTypeId: string;
  descriptionKey: string;
  descriptionParams: Record<string, string | number>;
};

export type CurrencyRateRow = {
  rate: number;
  validFrom: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
};

export function totalProduced(rows: readonly BulkQuantityRow[]): number {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

export function totalDistributed(
  quantities: Record<string, unknown>,
  memberIds: readonly string[],
): number {
  let sum = 0;
  for (const memberId of memberIds) {
    const raw = quantities[memberId];
    if (raw === '' || raw === null || raw === undefined) {
      continue;
    }
    const numeric = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (Number.isFinite(numeric) && numeric > 0 && Number.isInteger(numeric)) {
      sum += numeric;
    }
  }
  return sum;
}

export function remainingEggs(produced: number, distributed: number): number {
  return produced - distributed;
}

export function isOverDistributed(
  produced: number,
  distributed: number,
): boolean {
  return distributed > produced;
}

export function membershipValidOnDate(
  validFrom: string | null | undefined,
  validTo: string | null | undefined,
  isoDate: string,
): boolean {
  const dayStart = `${isoDate}T00:00:00.000Z`;
  const dayEnd = `${isoDate}T23:59:59.999Z`;
  if (validFrom) {
    const from = new Date(validFrom);
    if (!Number.isNaN(from.getTime()) && from.toISOString() > dayEnd) {
      return false;
    }
  }
  if (validTo) {
    const to = new Date(validTo);
    if (!Number.isNaN(to.getTime()) && to.toISOString() < dayStart) {
      return false;
    }
  }
  return true;
}

/** Latest rate with valid_from on or before the form date (inclusive, UTC day). */
export function pickLatestCurrencyRate(
  rates: readonly CurrencyRateRow[],
  fromCode: string,
  toCode: string,
  isoDate: string,
): CurrencyRateRow | null {
  if (fromCode === toCode) {
    return {
      rate: 1,
      validFrom: `${isoDate}T00:00:00.000Z`,
      fromCurrencyCode: fromCode,
      toCurrencyCode: toCode,
    };
  }
  const dayEnd = `${isoDate}T23:59:59.999Z`;
  const matching = rates.filter(
    (row) =>
      row.fromCurrencyCode === fromCode &&
      row.toCurrencyCode === toCode &&
      row.validFrom <= dayEnd,
  );
  if (matching.length === 0) {
    return null;
  }
  matching.sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1));
  return matching[0] ?? null;
}

/** Revenue in sale currency: eggs × ratio × (EGG → sale currency rate). */
export function saleRevenueAmount(
  eggs: number,
  ratio: number,
  eggToSaleRate: number,
): number {
  const raw = eggs * ratio * eggToSaleRate;
  return Math.round(raw * 100) / 100;
}

export function distributionRowsFromQuantities(
  members: readonly {
    memberId: string;
    memberName: string;
    membershipTypeName: string | null;
    membershipRules: unknown;
    membershipTypeRules: unknown;
    memberAccountId: string | null;
  }[],
  quantities: Record<string, unknown>,
): DistributionMemberRow[] {
  const rows: DistributionMemberRow[] = [];
  for (const member of members) {
    const raw = quantities[member.memberId];
    if (raw === '' || raw === null || raw === undefined) {
      continue;
    }
    const amount = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      continue;
    }
    rows.push({
      memberId: member.memberId,
      memberName: member.memberName,
      amount,
      eggRule: resolveEggRule(
        member.membershipRules,
        member.membershipTypeRules,
        member.membershipTypeName,
      ),
      memberAccountId: member.memberAccountId,
    });
  }
  return rows;
}

export function buildDistributionLegs(input: {
  rows: readonly DistributionMemberRow[];
  bookingOrganizationId: string;
  eggCurrencyTypeId: string;
  saleCurrencyTypeId: string;
  inventoryAccountId: string;
  saleCashAccountId: string;
  revenueAccountId: string;
  memberPrivateAccountIdForRow: (row: DistributionMemberRow) => string | null;
  internalTransactionTypeId: string;
  saleEggTransactionTypeId: string;
  saleCashPaymentTransactionTypeId: string;
  saleRevenueTransactionTypeId: string;
  eggToSaleRate: number;
}): DistributionTransactionLeg[] {
  const legs: DistributionTransactionLeg[] = [];
  for (const row of input.rows) {
    const memberPrivateAccountId = input.memberPrivateAccountIdForRow(row);
    if (!memberPrivateAccountId) {
      continue;
    }

    if (row.eggRule.mode === 'internal') {
      legs.push({
        legKey: `${row.memberId}:internal`,
        organizationId: input.bookingOrganizationId,
        memberId: row.memberId,
        memberName: row.memberName,
        amount: row.amount,
        currencyTypeId: input.eggCurrencyTypeId,
        debitAccountId: memberPrivateAccountId,
        creditAccountId: input.inventoryAccountId,
        transactionTypeId: input.internalTransactionTypeId,
        descriptionKey:
          'app.bulk_quantity.description.egg_distribution_internal',
        descriptionParams: {
          member: row.memberName,
          amount: row.amount,
        },
      });
      continue;
    }

    const revenue = saleRevenueAmount(
      row.amount,
      row.eggRule.ratio,
      input.eggToSaleRate,
    );
    if (revenue <= 0) {
      continue;
    }

    legs.push({
      legKey: `${row.memberId}:egg`,
      organizationId: input.bookingOrganizationId,
      memberId: row.memberId,
      memberName: row.memberName,
      amount: row.amount,
      currencyTypeId: input.eggCurrencyTypeId,
      debitAccountId: memberPrivateAccountId,
      creditAccountId: input.inventoryAccountId,
      transactionTypeId: input.saleEggTransactionTypeId,
      descriptionKey: 'app.bulk_quantity.description.egg_distribution_sale_egg',
      descriptionParams: { member: row.memberName, amount: row.amount },
    });

    legs.push({
      legKey: `${row.memberId}:cash`,
      organizationId: input.bookingOrganizationId,
      memberId: row.memberId,
      memberName: row.memberName,
      amount: revenue,
      currencyTypeId: input.saleCurrencyTypeId,
      debitAccountId: input.saleCashAccountId,
      creditAccountId: memberPrivateAccountId,
      transactionTypeId: input.saleCashPaymentTransactionTypeId,
      descriptionKey: 'app.bulk_quantity.description.egg_distribution_cash',
      descriptionParams: {
        member: row.memberName,
        amount: row.amount,
        revenue,
      },
    });

    legs.push({
      legKey: `${row.memberId}:revenue`,
      organizationId: input.bookingOrganizationId,
      memberId: row.memberId,
      memberName: row.memberName,
      amount: revenue,
      currencyTypeId: input.saleCurrencyTypeId,
      debitAccountId: input.revenueAccountId,
      creditAccountId: input.saleCashAccountId,
      transactionTypeId: input.saleRevenueTransactionTypeId,
      descriptionKey: 'app.bulk_quantity.description.egg_distribution_revenue',
      descriptionParams: {
        member: row.memberName,
        amount: row.amount,
        revenue,
      },
    });
  }
  return legs;
}

export function memberNeedsSaleRate(
  members: readonly {
    membershipTypeName: string | null;
    membershipRules: unknown;
    membershipTypeRules: unknown;
  }[],
): boolean {
  return members.some(
    (member) =>
      resolveEggRule(
        member.membershipRules,
        member.membershipTypeRules,
        member.membershipTypeName,
      ).mode === 'sale',
  );
}
