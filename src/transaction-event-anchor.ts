/**
 * Groups transaction rows that belong to one business event (produce batch, sheet row, form submit).
 * Followers store `related_transaction` → anchor documentId; the anchor leaves the field empty.
 *
 * Same relation as transaction-workflow convert (keep_original: steps → source row).
 */

export type EventAnchorRow = {
  entered_key: string;
  sheet_row?: number | null;
  leg?: string | null;
};

export const DEFAULT_PRODUCTION_LEG = 'production';

/**
 * Assign `related_transaction_entered_key` for JSON/http import (resolved to documentId at upload).
 * Per sheet row: anchor = production leg if present, else the first leg emitted for that row.
 */
export function assignRelatedEnteredKeys<
  T extends EventAnchorRow,
>(
  rows: readonly T[],
  options?: {
    sheetRowField?: keyof T;
    legField?: keyof T;
    productionLeg?: string;
  },
): (T & { related_transaction_entered_key: string | null })[] {
  const sheetRowField = (options?.sheetRowField ?? 'sheet_row') as keyof T;
  const legField = (options?.legField ?? 'leg') as keyof T;
  const productionLeg = options?.productionLeg ?? DEFAULT_PRODUCTION_LEG;

  const anchorBySheetRow = new Map<number, string>();

  for (const row of rows) {
    const sheetRow = row[sheetRowField];
    if (typeof sheetRow !== 'number') continue;
    if (row[legField] === productionLeg) {
      anchorBySheetRow.set(sheetRow, row.entered_key);
    }
  }

  for (const row of rows) {
    const sheetRow = row[sheetRowField];
    if (typeof sheetRow !== 'number') continue;
    if (!anchorBySheetRow.has(sheetRow)) {
      anchorBySheetRow.set(sheetRow, row.entered_key);
    }
  }

  return rows.map((row) => {
    const sheetRow = row[sheetRowField];
    const anchor =
      typeof sheetRow === 'number' ? anchorBySheetRow.get(sheetRow) : undefined;
    if (!anchor || row.entered_key === anchor) {
      return { ...row, related_transaction_entered_key: null };
    }
    return { ...row, related_transaction_entered_key: anchor };
  });
}

/** First successful production row in a bulk-quantity submit becomes the shared anchor. */
export function submissionAnchorDocumentId(
  results: ReadonlyArray<{ status: string; documentId?: string }>,
): string | undefined {
  for (const row of results) {
    if (row.status === 'success' && row.documentId) {
      return row.documentId;
    }
  }
  return undefined;
}

export function withRelatedTransactionDocumentId(
  payload: Record<string, unknown>,
  anchorDocumentId: string | undefined,
): Record<string, unknown> {
  if (!anchorDocumentId) return payload;
  return { ...payload, related_transaction: anchorDocumentId };
}

export type ProductionSaveResult = {
  status: string;
  documentId?: string;
  organizationId?: string;
};

export function productionAnchorByOrganizationId(
  results: readonly ProductionSaveResult[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of results) {
    if (
      row.status === 'success' &&
      row.documentId &&
      row.organizationId
    ) {
      map.set(row.organizationId, row.documentId);
    }
  }
  return map;
}

export function poolLegRelatedDocumentId(
  coopOrganizationId: string,
  productionByOrg: ReadonlyMap<string, string>,
  submissionAnchorDocumentId: string | undefined,
): string | undefined {
  return productionByOrg.get(coopOrganizationId) ?? submissionAnchorDocumentId;
}
