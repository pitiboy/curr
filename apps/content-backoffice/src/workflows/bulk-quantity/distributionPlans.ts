import {
  buildDistributionLegs,
  type DistributionMemberRow,
  type DistributionTransactionLeg,
} from './distributionLogic';
import { memberAccountDocumentIdByCode } from './memberAccounts';
import type {
  BulkQuantityDistributionConfig,
  BulkQuantityDuplicate,
  BulkQuantityGlobalConflictChoice,
  DistributionMember,
  DistributionResolvedRefs,
  DistributionTransactionLegPlan,
} from './types';

export function buildDistributionLegList(input: {
  distributionRows: readonly DistributionMemberRow[];
  members: readonly DistributionMember[];
  distributionRefs: DistributionResolvedRefs;
  distributionConfig: BulkQuantityDistributionConfig;
  eggToSaleRate: number;
}): DistributionTransactionLeg[] {
  const memberById = new Map(input.members.map((m) => [m.memberId, m]));
  return buildDistributionLegs({
    rows: input.distributionRows,
    bookingOrganizationId: input.distributionRefs.bookingOrganizationId,
    eggCurrencyTypeId: input.distributionRefs.eggCurrencyTypeId,
    saleCurrencyTypeId: input.distributionRefs.saleCurrencyTypeId,
    inventoryAccountId: input.distributionRefs.inventoryAccountId,
    saleExpenseAccountId: input.distributionRefs.saleExpenseAccountId,
    revenueAccountId: input.distributionRefs.revenueAccountId,
    internalTransactionTypeId: input.distributionRefs.internalTransactionTypeId,
    saleStockTransactionTypeId:
      input.distributionRefs.saleStockTransactionTypeId,
    saleRevenueTransactionTypeId:
      input.distributionRefs.saleRevenueTransactionTypeId,
    eggToSaleRate: input.eggToSaleRate,
    internalMemberAccountIdForRow: (row) => {
      const member = memberById.get(row.memberId);
      return memberAccountDocumentIdByCode(
        member,
        input.distributionConfig.internalMemberAccountCode,
      );
    },
    saleMemberAccountIdForRow: (row) => {
      const member = memberById.get(row.memberId);
      return memberAccountDocumentIdByCode(
        member,
        input.distributionConfig.saleMemberAccountCode,
      );
    },
  });
}

export function legPlansWithGlobalChoice(
  legs: readonly DistributionTransactionLeg[],
  duplicates: readonly BulkQuantityDuplicate[],
  choice: BulkQuantityGlobalConflictChoice,
  buildPayload: (leg: DistributionTransactionLeg) => Record<string, unknown>,
): DistributionTransactionLegPlan[] {
  const duplicateByLegKey = new Map(
    duplicates.map((item) => [item.row.organizationName, item]),
  );
  return legs.map((leg) => {
    const duplicate = duplicateByLegKey.get(leg.legKey);
    const action = duplicate ? choice : ('insert' as const);
    return {
      legKey: leg.legKey,
      memberId: leg.memberId,
      memberName: leg.memberName,
      action,
      updateDocumentId:
        action === 'update' ? duplicate?.existingDocumentId : undefined,
      payload: buildPayload(leg),
    };
  });
}

export function legToTransactionPayload(
  leg: DistributionTransactionLeg,
  date: string,
  description: string,
): Record<string, unknown> {
  return {
    date,
    amount: leg.amount,
    description,
    organization: leg.organizationId,
    debit_account: leg.debitAccountId,
    credit_account: leg.creditAccountId,
    currency_type: leg.currencyTypeId,
    transaction_type: leg.transactionTypeId,
  };
}
