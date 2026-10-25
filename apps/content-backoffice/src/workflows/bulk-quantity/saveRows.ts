import type { DataProvider } from 'react-admin';

import { saveTransactionDraft } from '../../data/dataProvider';
import type {
  BulkQuantityRowPlan,
  BulkQuantityRowResult,
  DistributionTransactionLegPlan,
} from './types';

export async function executeRowPlans(
  dataProvider: DataProvider,
  plans: readonly BulkQuantityRowPlan[],
  buildPayload: (plan: BulkQuantityRowPlan) => Record<string, unknown>,
): Promise<BulkQuantityRowResult[]> {
  const results: BulkQuantityRowResult[] = [];
  for (const plan of plans) {
    const payload = buildPayload(plan);
    try {
      if (plan.action === 'update' && plan.updateDocumentId) {
        await saveTransactionDraft(plan.updateDocumentId, payload);
        results.push({
          organizationId: plan.organizationId,
          organizationName: plan.organizationName,
          status: 'success',
          documentId: plan.updateDocumentId,
        });
      } else {
        const { data } = await dataProvider.create('transactions', {
          data: payload,
        });
        const documentId =
          typeof data.documentId === 'string'
            ? data.documentId
            : String(data.id ?? '');
        results.push({
          organizationId: plan.organizationId,
          organizationName: plan.organizationName,
          status: 'success',
          documentId,
        });
      }
    } catch (error) {
      results.push({
        organizationId: plan.organizationId,
        organizationName: plan.organizationName,
        status: 'error',
        message: error instanceof Error ? error.message : 'Save failed',
      });
    }
  }
  return results;
}

export async function executeLegPlans(
  dataProvider: DataProvider,
  plans: readonly DistributionTransactionLegPlan[],
): Promise<BulkQuantityRowResult[]> {
  const results: BulkQuantityRowResult[] = [];
  for (const plan of plans) {
    try {
      if (plan.action === 'update' && plan.updateDocumentId) {
        await saveTransactionDraft(plan.updateDocumentId, plan.payload);
        results.push({
          organizationId: plan.legKey,
          organizationName: plan.memberName,
          status: 'success',
          documentId: plan.updateDocumentId,
        });
      } else {
        const { data } = await dataProvider.create('transactions', {
          data: plan.payload,
        });
        const documentId =
          typeof data.documentId === 'string'
            ? data.documentId
            : String(data.id ?? '');
        results.push({
          organizationId: plan.legKey,
          organizationName: plan.memberName,
          status: 'success',
          documentId,
        });
      }
    } catch (error) {
      results.push({
        organizationId: plan.legKey,
        organizationName: plan.memberName,
        status: 'error',
        message: error instanceof Error ? error.message : 'Save failed',
      });
    }
  }
  return results;
}
