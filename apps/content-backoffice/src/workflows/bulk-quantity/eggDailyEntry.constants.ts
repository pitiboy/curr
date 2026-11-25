import poultryConstants from '../../../../../database/seeders/egg-poultry.constants.json';
import { MEMBER_PRIVATE_ACCOUNT_CODE } from './memberAccounts';

/** Hen houses' parent org: pooled stock + distribution (backend: `src/egg-production/constants.ts`). */
export const POULTRY_STOCK_ORGANIZATION_NAME =
  poultryConstants.poultryStockOrganizationName;

/** Single write endpoint: production + pool + distribution legs (backend builds them). */
export const EGG_PRODUCTION_ENTRIES_PATH = '/api/egg-production/entries';

/** Settings feature flag + workflow id (gates form menu and egg inventory report). */
export const EGG_PRODUCTION_WORKFLOW_ID = 'egg-production';

/** @deprecated Use {@link EGG_PRODUCTION_WORKFLOW_ID}. */
export const EGG_DAILY_ENTRY_WORKFLOW_ID = EGG_PRODUCTION_WORKFLOW_ID;

/** Bulk quantity production write (inventory debit, egg revenue credit). */
export const EGG_PRODUCTION_DEBIT_ACCOUNT_CODE = '1300';
export const EGG_PRODUCTION_CREDIT_ACCOUNT_CODE = '4500';

/** Aliases used by bulk-quantity config and distribution. */
export const DEBIT_ACCOUNT_CODE = EGG_PRODUCTION_DEBIT_ACCOUNT_CODE;
export const CREDIT_ACCOUNT_CODE = EGG_PRODUCTION_CREDIT_ACCOUNT_CODE;
export const DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE =
  MEMBER_PRIVATE_ACCOUNT_CODE;
export const DISTRIBUTION_INVENTORY_ACCOUNT_CODE =
  EGG_PRODUCTION_DEBIT_ACCOUNT_CODE;
export const DISTRIBUTION_SALE_CASH_ACCOUNT_CODE = '1000';
export const DISTRIBUTION_REVENUE_ACCOUNT_CODE = '4000';
