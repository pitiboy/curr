import poultryConstants from '../../../../../database/seeders/egg-poultry.constants.json';
import {
  EGG_PRODUCTION_CREDIT_ACCOUNT_CODE,
  EGG_PRODUCTION_DEBIT_ACCOUNT_CODE,
} from './eggDailyEntry.constants';
import type {
  BulkQuantityRow,
  BulkQuantityRowPlan,
  BulkQuantityResolvedRefs,
  DistributionTransactionLegPlan,
} from './types';

export const POULTRY_STOCK_ORGANIZATION_NAME =
  poultryConstants.poultryStockOrganizationName;

/** Coop leg reverses production on the hen-house org (1300 net → 0). */
export const POOL_TRANSFER_COOP_DEBIT_CODE = EGG_PRODUCTION_CREDIT_ACCOUNT_CODE;
export const POOL_TRANSFER_COOP_CREDIT_CODE = EGG_PRODUCTION_DEBIT_ACCOUNT_CODE;

/** Parent leg mirrors production on Tyúktartás (pooled 1300). */
export const POOL_TRANSFER_PARENT_DEBIT_CODE =
  EGG_PRODUCTION_DEBIT_ACCOUNT_CODE;
export const POOL_TRANSFER_PARENT_CREDIT_CODE =
  EGG_PRODUCTION_CREDIT_ACCOUNT_CODE;

export type PoolTransferResolvedRefs = {
  parentOrganizationId: string;
  coopOutDebitAccountId: string;
  coopOutCreditAccountId: string;
  parentInDebitAccountId: string;
  parentInCreditAccountId: string;
  currencyTypeId: string;
  transactionTypeId: string;
};

export function poolTransferLegKey(
  coopOrganizationId: string,
  kind: 'coop-out' | 'parent-in',
): string {
  return `${coopOrganizationId}:pool-${kind}`;
}

export function buildPoolTransferLegPlans(input: {
  row: BulkQuantityRow;
  date: string;
  poolRefs: PoolTransferResolvedRefs;
  coopOutDescription: string;
  parentInDescription: string;
  action: BulkQuantityRowPlan['action'];
  updateDocumentIds?: {
    coopOut?: string;
    parentIn?: string;
  };
}): DistributionTransactionLegPlan[] {
  const base = {
    memberId: input.row.organizationId,
    memberName: input.row.organizationName,
    action: input.action,
  };
  return [
    {
      ...base,
      legKey: poolTransferLegKey(input.row.organizationId, 'coop-out'),
      updateDocumentId: input.updateDocumentIds?.coopOut,
      payload: {
        date: input.date,
        amount: input.row.amount,
        description: input.coopOutDescription,
        organization: input.row.organizationId,
        debit_account: input.poolRefs.coopOutDebitAccountId,
        credit_account: input.poolRefs.coopOutCreditAccountId,
        currency_type: input.poolRefs.currencyTypeId,
        transaction_type: input.poolRefs.transactionTypeId,
      },
    },
    {
      ...base,
      legKey: poolTransferLegKey(input.row.organizationId, 'parent-in'),
      updateDocumentId: input.updateDocumentIds?.parentIn,
      payload: {
        date: input.date,
        amount: input.row.amount,
        description: input.parentInDescription,
        organization: input.poolRefs.parentOrganizationId,
        debit_account: input.poolRefs.parentInDebitAccountId,
        credit_account: input.poolRefs.parentInCreditAccountId,
        currency_type: input.poolRefs.currencyTypeId,
        transaction_type: input.poolRefs.transactionTypeId,
      },
    },
  ];
}

export function poolTransferRefsFromCatalog(
  refs: BulkQuantityResolvedRefs,
  parentOrganizationId: string,
  coopOutDebitId: string,
  coopOutCreditId: string,
): PoolTransferResolvedRefs {
  return {
    parentOrganizationId,
    coopOutDebitAccountId: coopOutDebitId,
    coopOutCreditAccountId: coopOutCreditId,
    parentInDebitAccountId: refs.debitAccountId,
    parentInCreditAccountId: refs.creditAccountId,
    currencyTypeId: refs.currencyTypeId,
    transactionTypeId: refs.transactionTypeId,
  };
}
