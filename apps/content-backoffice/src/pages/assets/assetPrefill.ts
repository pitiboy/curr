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
import {
  fetchStrapiList,
  loadReportTransactions,
} from '../reports/shared/reportTransactionStatus';
import { loadTransactionUsage } from './transactionUsage';
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

/** Form fields the acquisition transaction can fill on the asset form. */
export type AcquisitionFieldPrefill = Partial<{
  name: string;
  purchase_price: number;
  currency_type: string;
  purchase_date: string;
  organization: string;
  responsible_member: string;
}>;

type AcquisitionTx = Pick<
  StrapiTransaction,
  'amount' | 'date' | 'description' | 'currency_type' | 'organization'
>;

/**
 * Picked acquisition transaction → asset fields. The price is what is still
 * free on the transaction (amount − other linked assets); nothing when the
 * transaction is already fully covered.
 */
export function acquisitionFieldPrefill(
  tx: AcquisitionTx,
  options: { linkedTotal?: number; memberId?: string | null } = {},
): AcquisitionFieldPrefill {
  const out: AcquisitionFieldPrefill = {};
  const name = nameFromDescription(tx.description);
  if (name) out.name = name;
  const amount = positiveAmount(tx.amount);
  if (amount != null) {
    const remaining =
      Math.round((amount - (options.linkedTotal ?? 0)) * 10_000) / 10_000;
    if (remaining > 0) out.purchase_price = remaining;
  }
  const currency = relationDocumentId(tx.currency_type);
  if (currency) out.currency_type = currency;
  const date = text(tx.date);
  if (date) out.purchase_date = date.slice(0, 10);
  const organization = relationDocumentId(tx.organization);
  if (organization) out.organization = organization;
  const member = text(options.memberId);
  if (member) out.responsible_member = member;
  return out;
}

/**
 * Which prefilled fields to write: empty ones, and ones still holding the
 * value an earlier pick filled in (switching transactions follows along).
 * Anything the user typed is kept.
 */
export function prefillChanges(
  current: Record<string, unknown>,
  next: AcquisitionFieldPrefill,
  previous: AcquisitionFieldPrefill = {},
): AcquisitionFieldPrefill {
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    const now = current[key];
    const empty = now == null || now === '';
    const untouched =
      previous[key as keyof AcquisitionFieldPrefill] !== undefined &&
      String(now) === String(previous[key as keyof AcquisitionFieldPrefill]);
    if ((empty || untouched) && String(now ?? '') !== String(value)) {
      changes[key] = value;
    }
  }
  return changes as AcquisitionFieldPrefill;
}

type MemberAccountRow = {
  documentId?: string;
  account?: { documentId?: string | null } | null;
  private_account?: { documentId?: string | null } | null;
};

/** First member whose share or pocket account is one of `accountIds` (in order). */
export async function findMemberByAccount(
  httpClient: ContentHttpClient,
  accountIds: readonly string[],
): Promise<string | null> {
  const ids = [...new Set(accountIds.filter(Boolean))];
  if (ids.length === 0) return null;
  const rows = await fetchStrapiList<MemberAccountRow>(
    httpClient,
    '/api/members',
    {
      filters: {
        $or: [
          { account: { documentId: { $in: ids } } },
          { private_account: { documentId: { $in: ids } } },
        ],
      },
      fields: ['documentId'],
      populate: {
        account: { fields: ['documentId'] },
        private_account: { fields: ['documentId'] },
      },
    },
    { maxPages: 1 },
  );
  for (const id of ids) {
    const member = rows.find(
      (row) =>
        row.account?.documentId === id ||
        row.private_account?.documentId === id,
    );
    if (member?.documentId) return member.documentId;
  }
  return null;
}

/**
 * Loads the picked acquisition transaction and returns the asset fields it can fill. The responsible member comes
 * from the credit account of the leg, else of the original deal.
 */
export async function loadAcquisitionPrefill(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  transactionId: string,
  excludeAssetId?: string | null,
): Promise<AcquisitionFieldPrefill> {
  const [tx, usage] = await Promise.all([
    loadTransactionRecord(httpClient, strapiUrl, transactionId),
    loadTransactionUsage(httpClient, [transactionId], 'debit', excludeAssetId),
  ]);
  if (!tx) return {};
  // `transactionPopulate` brings the original's credit account along.
  const original = (
    tx as {
      related_transaction?: {
        credit_account?: { documentId?: string } | null;
      } | null;
    }
  ).related_transaction;
  const memberId = await findMemberByAccount(
    httpClient,
    [
      relationDocumentId(tx.credit_account),
      relationDocumentId(original?.credit_account),
    ].filter((id): id is string => Boolean(id)),
  );
  return acquisitionFieldPrefill(tx, {
    linkedTotal: usage.get(transactionId)?.linkedTotal,
    memberId,
  });
}
