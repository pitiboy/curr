/**
 * Tojás továbbosztás — tiszta segédfüggvények (Strapi nélkül).
 * (Korábban: apps/content-backoffice/.../bulk-quantity/distributionLogic.ts.)
 *
 * A backoffice is ezt importálja (összesítő / árfolyam kijelzés), de a
 * lábakat már csak a backend állítja elő (`plan.ts`).
 */
import { resolveEggRule } from './membership-rules';

export type CurrencyRateRow = {
  rate: number;
  validFrom: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
};

/** Positive integer quantity or null (empty / 0 / invalid). */
export function parsePositiveQuantity(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const numeric =
    typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(numeric) || numeric <= 0 || !Number.isInteger(numeric)) {
    return null;
  }
  return numeric;
}

export function totalProduced(rows: readonly { amount: number }[]): number {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

export function totalDistributed(
  quantities: Record<string, unknown>,
  memberIds: readonly string[],
): number {
  let sum = 0;
  for (const memberId of memberIds) {
    const amount = parsePositiveQuantity(quantities[memberId]);
    if (amount !== null) {
      sum += amount;
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

/** Inclusive UTC day check on `valid_from` / `valid_to`. */
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
  return Math.round(raw * 10_000) / 10_000;
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
