import type { ContentRole } from '../../auth/roles';

export type BulkQuantityWorkflowConfig = {
  workflowId: string;
  path: string;
  labelKey: string;
  parentOrganizationName: string;
  currencyCode: string;
  debitAccountCode: string;
  creditAccountCode: string;
  transactionTypeName: string;
  descriptionKey: string;
  roles: readonly ContentRole[];
};

export type BulkQuantityHenHouse = {
  documentId: string;
  name: string;
};

export type BulkQuantityResolvedRefs = {
  currencyTypeId: string;
  debitAccountId: string;
  creditAccountId: string;
  transactionTypeId: string;
};

export type BulkQuantityRow = {
  organizationId: string;
  organizationName: string;
  amount: number;
};

export type BulkQuantityDuplicate = {
  row: BulkQuantityRow;
  existingDocumentId: string;
  existingAmount: number;
};

export type BulkQuantityConflictChoice = 'insert' | 'update';

export type BulkQuantityRowPlan = BulkQuantityRow & {
  action: BulkQuantityConflictChoice;
  updateDocumentId?: string;
};

export type BulkQuantityRowResult = {
  organizationId: string;
  organizationName: string;
  status: 'success' | 'error';
  message?: string;
  documentId?: string;
};
