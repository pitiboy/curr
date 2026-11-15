/**
 * Workflow → "Új eszköz" redirect. After a `collect_asset` workflow is booked
 * (save + convert), the asset create form opens prefilled from the booked
 * transaction. React Admin `<Create>` reads the `?source=` JSON as defaults.
 */
import type { ContentHttpClient } from '../../data/receiptDraft';
import { loadTransactionRecord } from '../../data/transactionRecord';
import {
  relationDocumentId,
  type StrapiTransaction,
} from '../../data/transactionList';
import { loadReportTransactions } from '../reports/shared/reportTransactionStatus';
import {
  ASSETS_RESOURCE,
  DEFAULT_ASSET_OWNERSHIP_TYPE,
  DEFAULT_ASSET_STATUS,
  FIXED_ASSET_ACCOUNT_CODE,
} from './assetConstants';

export const ASSET_CREATE_PATH = `/${ASSETS_RESOURCE}/create`;

export type AssetPrefillRecord = {
  name?: string;
  ownership_type: string;
  status: string;
  purchase_price?: number;
  currency_type?: string;
  purchase_date?: string;
  organization?: string;
  acquisition_transaction?: string;
};

export type AssetPrefillSource = {
  amount?: string | number | null;
  currencyTypeId?: string | null;
  date?: string | null;
  organizationId?: string | null;
  description?: string | null;
  acquisitionTransactionId?: string | null;
};

function positiveAmount(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Name prefill: first segment of the booked description (before ` | `). */
function nameFromDescription(description: unknown): string | undefined {
  const value = text(description);
  if (!value) return undefined;
  const first = value.split(' | ')[0]!.trim();
  return first.length > 255 ? first.slice(0, 255) : first;
}

export function buildAssetPrefillRecord(
  source: AssetPrefillSource,
): AssetPrefillRecord {
  const record: AssetPrefillRecord = {
    ownership_type: DEFAULT_ASSET_OWNERSHIP_TYPE,
    status: DEFAULT_ASSET_STATUS,
  };
  const name = nameFromDescription(source.description);
  if (name) record.name = name;
  const price = positiveAmount(source.amount);
  if (price != null) record.purchase_price = price;
  const currency = text(source.currencyTypeId);
  if (currency) record.currency_type = currency;
  const date = text(source.date);
  if (date) record.purchase_date = date.slice(0, 10);
  const organization = text(source.organizationId);
  if (organization) record.organization = organization;
  const tx = text(source.acquisitionTransactionId);
  if (tx) record.acquisition_transaction = tx;
  return record;
}

/** `/assets/create?source=<json>` — React Admin Create prefill. */
export function assetCreatePathWithPrefill(record: AssetPrefillRecord): string {
  const params = new URLSearchParams();
  params.set('source', JSON.stringify(record));
  return `${ASSET_CREATE_PATH}?${params.toString()}`;
}

type LegRow = Pick<StrapiTransaction, 'documentId' | 'amount'> & {
  debit_account?: { code?: string | number | null } | null;
};

/**
 * The asset links to the booked leg that debits 1500 (book value), in the
 * convert's step order; falls back to the booked original.
 */
export function pickAcquisitionTransactionId(
  createdDocumentIds: readonly string[],
  legs: readonly LegRow[],
  fallbackDocumentId: string,
): string {
  const byId = new Map(
    legs
      .filter((row) => row.documentId)
      .map((row) => [row.documentId as string, row]),
  );
  for (const id of createdDocumentIds) {
    const row = byId.get(id);
    if (!row) continue;
    const debitCode = String(row.debit_account?.code ?? '').trim();
    if (debitCode === FIXED_ASSET_ACCOUNT_CODE && positiveAmount(row.amount)) {
      return id;
    }
  }
  return fallbackDocumentId;
}

/** Loads the booked rows and returns the prefilled "Új eszköz" path. */
export async function assetCreatePathAfterBooking(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  input: { originalDocumentId: string; createdDocumentIds: readonly string[] },
): Promise<string> {
  const [original, legs] = await Promise.all([
    loadTransactionRecord(httpClient, strapiUrl, input.originalDocumentId),
    input.createdDocumentIds.length > 0
      ? loadReportTransactions<LegRow>(httpClient, 'all', {
          filters: { documentId: { $in: [...input.createdDocumentIds] } },
          fields: ['documentId', 'amount'],
          populate: { debit_account: { fields: ['code'] } },
        })
      : Promise.resolve([] as LegRow[]),
  ]);
  const acquisitionTransactionId = pickAcquisitionTransactionId(
    input.createdDocumentIds,
    legs,
    input.originalDocumentId,
  );
  return assetCreatePathWithPrefill(
    buildAssetPrefillRecord({
      amount: original?.amount,
      currencyTypeId: relationDocumentId(original?.currency_type),
      date: original?.date,
      organizationId: relationDocumentId(original?.organization),
      description: original?.description,
      acquisitionTransactionId,
    }),
  );
}
