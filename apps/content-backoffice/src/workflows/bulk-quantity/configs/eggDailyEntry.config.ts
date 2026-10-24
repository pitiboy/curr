import {
  MEMBER_PRIVATE_ACCOUNT_CODE,
  MEMBER_TAG_ACCOUNT_CODE,
} from '../memberAccounts';
import type {
  BulkQuantityDistributionConfig,
  BulkQuantityWorkflowConfig,
} from '../types';

/** Members listed on the distribution step (membership.organization). */
export const DISTRIBUTION_MEMBER_ORG = 'I/4.12.1.2.1 Tyúktartás';

/** Hen houses and booking org for distribution legs (parent org under Állattenyésztés). */
export const PULTRY_PARENT_ORG_NAME = DISTRIBUTION_MEMBER_ORG;

export const DEBIT_ACCOUNT_CODE = '1300';
export const CREDIT_ACCOUNT_CODE = '4500';

/** Member saját (Homály) account code — see `src/member-accounts.ts`. */
export const DISTRIBUTION_INTERNAL_ACCOUNT_CODE = MEMBER_PRIVATE_ACCOUNT_CODE;

/** Member tagi account code for sale revenue legs. */
export const DISTRIBUTION_SALE_MEMBER_ACCOUNT_CODE = MEMBER_TAG_ACCOUNT_CODE;

export const DISTRIBUTION_STOCK_DEBIT_CODE = '5600';
export const DISTRIBUTION_STOCK_CREDIT_CODE = '1300';
export const DISTRIBUTION_REVENUE_CREDIT_CODE = '4000';

export const eggDistributionConfig: BulkQuantityDistributionConfig = {
  memberOrganizationName: DISTRIBUTION_MEMBER_ORG,
  bookingOrganizationName: DISTRIBUTION_MEMBER_ORG,
  rulesKey: 'egg',
  internalMemberAccountCode: DISTRIBUTION_INTERNAL_ACCOUNT_CODE,
  saleMemberAccountCode: DISTRIBUTION_SALE_MEMBER_ACCOUNT_CODE,
  stockDebitAccountCode: DISTRIBUTION_STOCK_DEBIT_CODE,
  stockCreditAccountCode: DISTRIBUTION_STOCK_CREDIT_CODE,
  revenueCreditAccountCode: DISTRIBUTION_REVENUE_CREDIT_CODE,
  internalTransactionTypeName: 'Átvezetés',
  saleStockTransactionTypeName: 'Átvezetés',
  saleRevenueTransactionTypeName: 'Átvezetés',
};

export const eggDailyEntryConfig: BulkQuantityWorkflowConfig = {
  workflowId: 'egg-daily-entry',
  path: '/workflows/egg-daily-entry',
  labelKey: 'app.workflows.egg-daily-entry',
  parentOrganizationName: PULTRY_PARENT_ORG_NAME,
  currencyCode: 'EGG',
  debitAccountCode: DEBIT_ACCOUNT_CODE,
  creditAccountCode: CREDIT_ACCOUNT_CODE,
  transactionTypeName: 'Átvezetés',
  descriptionKey: 'app.bulk_quantity.description.egg',
  roles: ['dataentry', 'editor'],
  distribution: eggDistributionConfig,
};
