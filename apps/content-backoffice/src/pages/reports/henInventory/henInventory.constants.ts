import { DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE } from '../../../workflows/bulk-quantity/eggDailyEntry.constants';

/** Laying-hen stock currency (tojó tyúk). */
export const HEN_CURRENCY_CODE = 'HEN';

/** Poultry headcount currencies on ledger 1300 (csirke, tojó, kakas). */
export const POULTRY_INVENTORY_CURRENCY_CODES = [
  'CHICK',
  HEN_CURRENCY_CODE,
  'ROOSTER',
] as const;

const poultryInventoryCurrencySet = new Set<string>(
  POULTRY_INVENTORY_CURRENCY_CODES,
);

export function isPoultryInventoryCurrency(code: string): boolean {
  return poultryInventoryCurrencySet.has(code);
}

export const HEN_INVENTORY_ACCOUNT_CODE = '1300';
export const HEN_MEMBER_PRIVATE_ACCOUNT_CODE =
  DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE;
export const HEN_MORTALITY_EXPENSE_ACCOUNT_CODE = '5810';

export const HEN_SLAUGHTER_DESCRIPTION_RE = /levágás/i;
export const HEN_TRANSFER_DESCRIPTION_RE = /átad/i;
