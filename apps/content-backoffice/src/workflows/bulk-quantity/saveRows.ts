import type { DataProvider } from 'react-admin';

import {
  poolLegRelatedDocumentId,
  productionAnchorByOrganizationId,
  withRelatedTransactionDocumentId,
} from '../../../../../src/transaction-event-anchor.ts';
import { saveTransactionDraft } from '../../data/dataProvider';
import type {
  BulkQuantityRowPlan,
  BulkQuantityRowResult,
  DistributionTransactionLegPlan,
} from './types';

export type BulkQuantityAfterSaveContext = {
  documentId: string;
  wasUpdate: boolean;
};

export type BulkQuantityAfterSaveOutcome =
  | { status: 'ok'; note?: string }
  | { status: 'skipped'; reason?: string }
  | { status: 'error'; message: string };

export async function executeRowPlans(
  dataProvider: DataProvider,
  plans: readonly BulkQuantityRowPlan[],
  buildPayload: (plan: BulkQuantityRowPlan) => Record<string, unknown>,
  options?: {
    onAfterSuccessfulSave?: (
      ctx: BulkQuantityAfterSaveContext,
    ) => Promise<BulkQuantityAfterSaveOutcome>;
  },
): Promise<BulkQuantityRowResult[]> {
  const results: BulkQuantityRowResult[] = [];
  const onAfter = options?.onAfterSuccessfulSave;
  for (const plan of plans) {
    const payload = withRelatedTransactionDocumentId(
      buildPayload(plan),
      plan.relatedTransactionDocumentId,
    );
    try {
      if (plan.action === 'update' && plan.updateDocumentId) {
        await saveTransactionDraft(plan.updateDocumentId, payload);
        const documentId = plan.updateDocumentId;
        let note: string | undefined;
        if (onAfter) {
          const outcome = await onAfter({
            documentId,
            wasUpdate: true,
          });
          if (outcome.status === 'error') {
            results.push({
              organizationId: plan.organizationId,
              organizationName: plan.organizationName,
              status: 'error',
              documentId,
              message: outcome.message,
            });
            continue;
          }
          if (outcome.status === 'skipped' && outcome.reason) {
            note = outcome.reason;
          }
          if (outcome.status === 'ok' && outcome.note) {
            note = outcome.note;
          }
        }
        results.push({
          organizationId: plan.organizationId,
          organizationName: plan.organizationName,
          status: 'success',
          documentId,
          message: note,
        });
      } else {
        const { data } = await dataProvider.create('transactions', {
          data: payload,
        });
        const documentId =
          typeof data.documentId === 'string'
            ? data.documentId
            : String(data.id ?? '');
        let note: string | undefined;
        if (onAfter && documentId) {
          const outcome = await onAfter({
            documentId,
            wasUpdate: false,
          });
          if (outcome.status === 'error') {
            results.push({
              organizationId: plan.organizationId,
              organizationName: plan.organizationName,
              status: 'error',
              documentId,
              message: outcome.message,
            });
            continue;
          }
          if (outcome.status === 'skipped' && outcome.reason) {
            note = outcome.reason;
          }
          if (outcome.status === 'ok' && outcome.note) {
            note = outcome.note;
          }
        }
        results.push({
          organizationId: plan.organizationId,
          organizationName: plan.organizationName,
          status: 'success',
          documentId,
          message: note,
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

/** Saves rows one-by-one so later rows can link to the first successful anchor. */
export async function executeRowPlansSequentially(
  dataProvider: DataProvider,
  plans: readonly BulkQuantityRowPlan[],
  buildPayload: (plan: BulkQuantityRowPlan) => Record<string, unknown>,
  options?: {
    linkFollowingRowsToFirstSuccess?: boolean;
    onAfterSuccessfulSave?: (
      ctx: BulkQuantityAfterSaveContext,
    ) => Promise<BulkQuantityAfterSaveOutcome>;
  },
): Promise<BulkQuantityRowResult[]> {
  let eventAnchorDocumentId: string | undefined;
  const results: BulkQuantityRowResult[] = [];
  for (const plan of plans) {
    const relatedId = options?.linkFollowingRowsToFirstSuccess
      ? (plan.relatedTransactionDocumentId ?? eventAnchorDocumentId)
      : plan.relatedTransactionDocumentId;
    const batch = await executeRowPlans(
      dataProvider,
      [{ ...plan, relatedTransactionDocumentId: relatedId }],
      buildPayload,
      { onAfterSuccessfulSave: options?.onAfterSuccessfulSave },
    );
    results.push(...batch);
    if (
      options?.linkFollowingRowsToFirstSuccess &&
      !eventAnchorDocumentId &&
      batch[0]?.status === 'success' &&
      batch[0].documentId
    ) {
      eventAnchorDocumentId = batch[0].documentId;
    }
  }
  return results;
}

export function attachPoolLegAnchors(
  poolLegPlans: readonly DistributionTransactionLegPlan[],
  productionByOrg: ReadonlyMap<string, string>,
  submissionAnchorDocumentId: string | undefined,
): DistributionTransactionLegPlan[] {
  return poolLegPlans.map((plan) => ({
    ...plan,
    relatedTransactionDocumentId: poolLegRelatedDocumentId(
      plan.memberId,
      productionByOrg,
      submissionAnchorDocumentId,
    ),
  }));
}

export { productionAnchorByOrganizationId };

export function attachDistributionLegAnchors(
  legPlans: readonly DistributionTransactionLegPlan[],
  submissionAnchorDocumentId: string | undefined,
): DistributionTransactionLegPlan[] {
  if (!submissionAnchorDocumentId) {
    return [...legPlans];
  }
  return legPlans.map((plan) => ({
    ...plan,
    relatedTransactionDocumentId: submissionAnchorDocumentId,
  }));
}

export async function executeLegPlans(
  dataProvider: DataProvider,
  plans: readonly DistributionTransactionLegPlan[],
  options?: {
    onAfterSuccessfulSave?: (
      ctx: BulkQuantityAfterSaveContext,
    ) => Promise<BulkQuantityAfterSaveOutcome>;
  },
): Promise<BulkQuantityRowResult[]> {
  const results: BulkQuantityRowResult[] = [];
  const onAfter = options?.onAfterSuccessfulSave;
  for (const plan of plans) {
    const payload = withRelatedTransactionDocumentId(
      plan.payload,
      plan.relatedTransactionDocumentId,
    );
    try {
      if (plan.action === 'update' && plan.updateDocumentId) {
        await saveTransactionDraft(plan.updateDocumentId, payload);
        const documentId = plan.updateDocumentId;
        let note: string | undefined;
        if (onAfter) {
          const outcome = await onAfter({
            documentId,
            wasUpdate: true,
          });
          if (outcome.status === 'error') {
            results.push({
              organizationId: plan.legKey,
              organizationName: plan.memberName,
              status: 'error',
              documentId,
              message: outcome.message,
            });
            continue;
          }
          if (outcome.status === 'skipped' && outcome.reason) {
            note = outcome.reason;
          }
          if (outcome.status === 'ok' && outcome.note) {
            note = outcome.note;
          }
        }
        results.push({
          organizationId: plan.legKey,
          organizationName: plan.memberName,
          status: 'success',
          documentId,
          message: note,
        });
      } else {
        const { data } = await dataProvider.create('transactions', {
          data: payload,
        });
        const documentId =
          typeof data.documentId === 'string'
            ? data.documentId
            : String(data.id ?? '');
        let note: string | undefined;
        if (onAfter && documentId) {
          const outcome = await onAfter({
            documentId,
            wasUpdate: false,
          });
          if (outcome.status === 'error') {
            results.push({
              organizationId: plan.legKey,
              organizationName: plan.memberName,
              status: 'error',
              documentId,
              message: outcome.message,
            });
            continue;
          }
          if (outcome.status === 'skipped' && outcome.reason) {
            note = outcome.reason;
          }
          if (outcome.status === 'ok' && outcome.note) {
            note = outcome.note;
          }
        }
        results.push({
          organizationId: plan.legKey,
          organizationName: plan.memberName,
          status: 'success',
          documentId,
          message: note,
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
