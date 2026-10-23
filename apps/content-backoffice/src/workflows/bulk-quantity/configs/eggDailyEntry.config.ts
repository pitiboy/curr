import type { BulkQuantityWorkflowConfig } from '../types';

/** Parent org in the edizone seed; hen houses are its direct children. */
export const PULTRY_PARENT_ORG_NAME = 'Tyúktartás';
export const DEBIT_ACCOUNT_CODE = '1300';
export const CREDIT_ACCOUNT_CODE = '4500';

export const eggDailyEntryConfig: BulkQuantityWorkflowConfig = {
  workflowId: 'egg-daily-entry',
  path: '/workflows/egg-daily-entry',
  labelKey: 'app.workflows.egg-daily-entry',
  parentOrganizationName: PULTRY_PARENT_ORG_NAME,
  currencyCode: 'EGG',
  debitAccountCode: DEBIT_ACCOUNT_CODE,
  creditAccountCode: CREDIT_ACCOUNT_CODE,
  /** Matches Ügylet 2 keletkezés in docs/transaction-workflow.md (Átvezetés). */
  transactionTypeName: 'Átvezetés',
  descriptionKey: 'app.bulk_quantity.description.egg',
  roles: ['dataentry', 'editor'],
};
