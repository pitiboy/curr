import type { ContentRole } from '../../auth/roles';

export type BulkQuantityDistributionConfig = {
  /** Organization whose memberships define distribution rows. */
  memberOrganizationName: string;
  /** `transaction.organization` on distribution legs (parent org). */
  bookingOrganizationName: string;
  rulesKey: 'egg';
  internalMemberAccountCode: string;
  saleMemberAccountCode: string;
  stockDebitAccountCode: string;
  stockCreditAccountCode: string;
  revenueCreditAccountCode: string;
  internalTransactionTypeName: string;
  saleStockTransactionTypeName: string;
  saleRevenueTransactionTypeName: string;
};

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
  distribution?: BulkQuantityDistributionConfig;
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

export type BulkQuantityGlobalConflictChoice = 'insert' | 'update';

export type DistributionMember = {
  memberId: string;
  memberName: string;
  membershipRules: unknown;
  membershipTypeRules: unknown;
  account: { documentId?: string; code?: string | null } | null;
  private_account: { documentId?: string; code?: string | null } | null;
};

export type DistributionResolvedRefs = {
  bookingOrganizationId: string;
  eggCurrencyTypeId: string;
  saleCurrencyTypeId: string;
  inventoryAccountId: string;
  saleExpenseAccountId: string;
  revenueAccountId: string;
  internalTransactionTypeId: string;
  saleStockTransactionTypeId: string;
  saleRevenueTransactionTypeId: string;
};

export type DistributionTransactionLegPlan = {
  legKey: string;
  memberId: string;
  memberName: string;
  action: BulkQuantityGlobalConflictChoice;
  updateDocumentId?: string;
  payload: Record<string, unknown>;
};
