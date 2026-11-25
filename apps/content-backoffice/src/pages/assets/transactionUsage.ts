import type { ContentHttpClient } from '../../data/receiptDraft';
import { fetchStrapiList } from '../reports/shared/reportTransactionStatus';
import { ASSETS_RESOURCE } from './assetConstants';
import type { TransactionPickerSide } from './transactionPicker';

/** How many assets already point at a transaction, and their Σ purchase price. */
export type TransactionUsage = {
  assetCount: number;
  linkedTotal: number;
};

/** Rounding tolerance (amounts are 4-decimal). */
export const TRANSACTION_USAGE_TOLERANCE = 0.00005;

type UsageAssetRow = {
  documentId?: string;
  purchase_price?: string | number | null;
  acquisition_transaction?: { documentId?: string | null } | null;
  disposal_transaction?: { documentId?: string | null } | null;
};

export function usageField(
  side: TransactionPickerSide,
): 'acquisition_transaction' | 'disposal_transaction' {
  return side === 'debit' ? 'acquisition_transaction' : 'disposal_transaction';
}

/** Groups asset rows by the linked transaction (the edited asset excluded). */
export function summarizeTransactionUsage(
  rows: readonly UsageAssetRow[],
  side: TransactionPickerSide,
  excludeAssetId?: string | null,
): Map<string, TransactionUsage> {
  const field = usageField(side);
  const usage = new Map<string, TransactionUsage>();
  for (const row of rows) {
    if (excludeAssetId && row.documentId === excludeAssetId) continue;
    const txId = row[field]?.documentId;
    if (!txId) continue;
    const entry = usage.get(txId) ?? { assetCount: 0, linkedTotal: 0 };
    entry.assetCount += 1;
    const price = Number(row.purchase_price);
    if (row.purchase_price != null && Number.isFinite(price)) {
      entry.linkedTotal =
        Math.round((entry.linkedTotal + price) * 10_000) / 10_000;
    }
    usage.set(txId, entry);
  }
  return usage;
}

/** Assets already linked to the given transactions (acquisition or disposal). */
export async function loadTransactionUsage(
  httpClient: ContentHttpClient,
  transactionIds: readonly string[],
  side: TransactionPickerSide,
  excludeAssetId?: string | null,
): Promise<Map<string, TransactionUsage>> {
  if (transactionIds.length === 0) return new Map();
  const field = usageField(side);
  const rows = await fetchStrapiList<UsageAssetRow>(
    httpClient,
    `/api/${ASSETS_RESOURCE}`,
    {
      filters: { [field]: { documentId: { $in: [...transactionIds] } } },
      fields: ['documentId', 'purchase_price'],
      populate: { [field]: { fields: ['documentId'] } },
    },
    { maxPages: 5 },
  );
  return summarizeTransactionUsage(rows, side, excludeAssetId);
}

/**
 * Over-linking check for the asset form: the other assets' Σ price plus this
 * asset's price exceeds the transaction amount. Returns the would-be total.
 */
export function overLinkedTotal(
  usage: TransactionUsage | undefined,
  ownPrice: number | null | undefined,
  transactionAmount: number | null | undefined,
): number | null {
  if (transactionAmount == null || !Number.isFinite(transactionAmount)) {
    return null;
  }
  const own = ownPrice != null && Number.isFinite(ownPrice) ? ownPrice : 0;
  const total = Math.round(((usage?.linkedTotal ?? 0) + own) * 10_000) / 10_000;
  return total - transactionAmount > TRANSACTION_USAGE_TOLERANCE ? total : null;
}
