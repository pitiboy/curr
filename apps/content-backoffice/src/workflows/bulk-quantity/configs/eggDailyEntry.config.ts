import {
  EGG_PRODUCTION_ENTRIES_PATH,
  EGG_PRODUCTION_WORKFLOW_ID,
  POULTRY_STOCK_ORGANIZATION_NAME,
} from '../eggDailyEntry.constants';
import type {
  BulkQuantityDistributionConfig,
  BulkQuantityWorkflowConfig,
} from '../types';

/** Members listed on the distribution step (membership.organization). */
export const DISTRIBUTION_MEMBER_ORG = POULTRY_STOCK_ORGANIZATION_NAME;

/** Hen houses under this org; pooled stock and distribution book here. */
export const PULTRY_PARENT_ORG_NAME = POULTRY_STOCK_ORGANIZATION_NAME;

export {
  CREDIT_ACCOUNT_CODE,
  DEBIT_ACCOUNT_CODE,
  DISTRIBUTION_INVENTORY_ACCOUNT_CODE,
  DISTRIBUTION_MEMBER_PRIVATE_ACCOUNT_CODE,
  DISTRIBUTION_REVENUE_ACCOUNT_CODE,
  DISTRIBUTION_SALE_CASH_ACCOUNT_CODE,
  EGG_PRODUCTION_WORKFLOW_ID,
} from '../eggDailyEntry.constants';

export const eggDistributionConfig: BulkQuantityDistributionConfig = {
  memberOrganizationName: DISTRIBUTION_MEMBER_ORG,
};

/**
 * Napi tojás: the wizard only collects quantities; `POST
 * /api/egg-production/entries` builds production + pool + distribution legs
 * with the transaction-workflow templates and writes them atomically.
 */
export const eggDailyEntryConfig: BulkQuantityWorkflowConfig = {
  workflowId: EGG_PRODUCTION_WORKFLOW_ID,
  path: '/workflows/egg-production',
  labelKey: 'app.workflows.egg-production',
  parentOrganizationName: PULTRY_PARENT_ORG_NAME,
  currencyCode: 'EGG',
  entriesPath: EGG_PRODUCTION_ENTRIES_PATH,
  roles: ['dataentry', 'editor', 'controller'],
  distribution: eggDistributionConfig,
};
