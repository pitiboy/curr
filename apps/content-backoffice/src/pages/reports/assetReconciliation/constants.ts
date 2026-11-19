import { KOR_CURRENCY_CODE } from '../../assets/assetConstants';

export { FIXED_ASSET_ACCOUNT_CODE } from '../../assets/assetConstants';

/**
 * Standing rule: KOR treasury transactions are excluded from every backoffice
 * report. TEMPORARILY HARDCODED — move to a Settings row when one exists.
 * A row is "KOR treasury" when it touches account 1100 in KOR currency
 * (HUF movements on 1100, e.g. paying a supplier, stay in the books).
 */
export const KOR_TREASURY_ACCOUNT_CODE = '1100';
export const KOR_TREASURY_CURRENCY_CODE = KOR_CURRENCY_CODE;

/** Rounding tolerance for the per-currency difference (amounts are 4-decimal). */
export const ASSET_RECONCILIATION_TOLERANCE = 0.00005;

/** List cap per mismatch table (same idea as the backend RECONCILIATION_ITEM_CAP). */
export const ASSET_RECONCILIATION_ITEM_CAP = 50;
