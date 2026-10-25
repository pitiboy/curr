import { MEMBER_PRIVATE_ACCOUNT_CODE } from '../memberAccounts';
import type {
  BulkQuantityDistributionConfig,
  BulkQuantityWorkflowConfig,
} from '../types';

/** Members listed on the distribution step (membership.organization). */
export const DISTRIBUTION_MEMBER_ORG = 'Tyúktartás';

/** Hen houses and booking org for distribution legs (parent org under Állattenyésztés). */
export const PULTRY_PARENT_ORG_NAME = DISTRIBUTION_MEMBER_ORG;

export const DEBIT_ACCOUNT_CODE = '1300';
export const CREDIT_ACCOUNT_CODE = '4500';

/** Member saját (Homály) account — sale egg, cash payment credit, revenue debit. */
export const DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE =
  MEMBER_PRIVATE_ACCOUNT_CODE;

export const DISTRIBUTION_INVENTORY_ACCOUNT_CODE = '1300';
export const DISTRIBUTION_SALE_CASH_ACCOUNT_CODE = '1000';
export const DISTRIBUTION_REVENUE_ACCOUNT_CODE = '4000';

export const eggDistributionConfig: BulkQuantityDistributionConfig = {
  memberOrganizationName: DISTRIBUTION_MEMBER_ORG,
  bookingOrganizationName: DISTRIBUTION_MEMBER_ORG,
  rulesKey: 'egg',
  memberPrivateAccountCode: DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE,
  inventoryAccountCode: DISTRIBUTION_INVENTORY_ACCOUNT_CODE,
  saleCashAccountCode: DISTRIBUTION_SALE_CASH_ACCOUNT_CODE,
  revenueCreditAccountCode: DISTRIBUTION_REVENUE_ACCOUNT_CODE,
  internalTransactionTypeName: 'Átvezetés',
  saleEggTransactionTypeName: 'Átvezetés',
  saleCashPaymentTransactionTypeName: 'Készpénz',
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
