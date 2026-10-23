import type { BulkQuantityWorkflowConfig } from '../types';

/** Parent org in the edizone seed; hen houses are its direct children. */
export const TYUKSTARTAS_PARENT_ORG_NAME = 'I/4.12.1.2.1 Tyúktartás';

export const eggDailyEntryConfig: BulkQuantityWorkflowConfig = {
  workflowId: 'egg-daily-entry',
  path: '/workflows/egg-daily-entry',
  labelKey: 'app.workflows.egg-daily-entry',
  parentOrganizationName: TYUKSTARTAS_PARENT_ORG_NAME,
  currencyCode: 'EGG',
  debitAccountCode: '1300',
  creditAccountCode: '4500',
  /** Matches Ügylet 2 keletkezés in docs/transaction-workflow.md (Átvezetés). */
  transactionTypeName: 'Átvezetés',
  descriptionKey: 'app.bulk_quantity.description.egg',
  roles: ['dataentry', 'editor'],
};
