import {
  ASSET_RECONCILIATION_TOLERANCE,
  FIXED_ASSET_ACCOUNT_CODE,
  KOR_TREASURY_ACCOUNT_CODE,
  KOR_TREASURY_CURRENCY_CODE,
} from './constants';
import type {
  AssetReconciliationAsset,
  AssetReconciliationCurrencyRow,
  AssetReconciliationReport,
  AssetReconciliationTransaction,
  AssetReconciliationTransactionMismatch,
} from './types';

const NO_CURRENCY = '—';

/** Standing rule: KOR treasury rows (1100 in KOR) never feed a report. */
export function isKorTreasuryTransaction(
  tx: Pick<
    AssetReconciliationTransaction,
    'debitCode' | 'creditCode' | 'currencyCode'
  >,
): boolean {
  return (
    tx.currencyCode === KOR_TREASURY_CURRENCY_CODE &&
    (tx.debitCode === KOR_TREASURY_ACCOUNT_CODE ||
      tx.creditCode === KOR_TREASURY_ACCOUNT_CODE)
  );
}

/** Assets that carry book value on 1500. */
export function countsTowardBookValue(
  asset: AssetReconciliationAsset,
): boolean {
  return (
    asset.ownershipType === 'coop_owned' &&
    asset.status !== 'disposed' &&
    asset.acquisitionTransactionId != null &&
    asset.purchasePrice != null &&
    Number.isFinite(asset.purchasePrice)
  );
}

function needsLink(asset: AssetReconciliationAsset): boolean {
  return (
    asset.ownershipType === 'coop_owned' &&
    asset.status !== 'disposed' &&
    asset.acquisitionTransactionId == null
  );
}

function roundAmount(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function add(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

/**
 * Per acquisition transaction: Σ purchase_price of every asset linked to it
 * (any ownership / status — over-linking is about the purchase itself) versus
 * its 1500 debit. An asset may link to the expanded 1500 leg or to the
 * original; for an original the 1500 debit is the sum of its expanded legs.
 * Transactions outside the current filters (no 1500 debit found) are skipped.
 */
export function transactionLinkMismatches(
  debits: readonly AssetReconciliationTransaction[],
  assets: readonly AssetReconciliationAsset[],
): AssetReconciliationTransactionMismatch[] {
  const byId = new Map<string, AssetReconciliationTransaction>();
  const legsByOriginal = new Map<string, AssetReconciliationTransaction[]>();
  for (const tx of debits) {
    byId.set(tx.documentId, tx);
    if (tx.relatedDocumentId) {
      const legs = legsByOriginal.get(tx.relatedDocumentId) ?? [];
      legs.push(tx);
      legsByOriginal.set(tx.relatedDocumentId, legs);
    }
  }

  const linked = new Map<string, { count: number; total: number }>();
  for (const asset of assets) {
    const id = asset.acquisitionTransactionId;
    if (!id) continue;
    const entry = linked.get(id) ?? { count: 0, total: 0 };
    entry.count += 1;
    if (asset.purchasePrice != null && Number.isFinite(asset.purchasePrice)) {
      entry.total += asset.purchasePrice;
    }
    linked.set(id, entry);
  }

  const mismatches: AssetReconciliationTransactionMismatch[] = [];
  for (const [id, { count, total }] of linked) {
    const direct = byId.get(id);
    const legs = direct ? [direct] : (legsByOriginal.get(id) ?? []);
    if (legs.length === 0) continue;
    const amount = roundAmount(legs.reduce((sum, leg) => sum + leg.amount, 0));
    const assetTotal = roundAmount(total);
    const difference = roundAmount(assetTotal - amount);
    if (Math.abs(difference) < ASSET_RECONCILIATION_TOLERANCE) continue;
    const first = legs[0]!;
    mismatches.push({
      documentId: id,
      date: first.date,
      description: first.description,
      currencyCode: first.currencyCode || NO_CURRENCY,
      amount,
      assetCount: count,
      assetTotal,
      difference,
    });
  }
  mismatches.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return mismatches;
}

export function aggregateAssetReconciliation(
  transactions: readonly AssetReconciliationTransaction[],
  assets: readonly AssetReconciliationAsset[],
): AssetReconciliationReport {
  const ledger = new Map<string, number>();
  const assetTotals = new Map<string, number>();
  const linkedTxIds = new Set<string>();
  for (const asset of assets) {
    if (asset.acquisitionTransactionId) {
      linkedTxIds.add(asset.acquisitionTransactionId);
    }
  }

  let excludedTreasuryCount = 0;
  const unlinkedDebits: AssetReconciliationTransaction[] = [];
  const debits: AssetReconciliationTransaction[] = [];
  for (const tx of transactions) {
    const debit = tx.debitCode === FIXED_ASSET_ACCOUNT_CODE;
    const credit = tx.creditCode === FIXED_ASSET_ACCOUNT_CODE;
    if (!debit && !credit) continue;
    if (isKorTreasuryTransaction(tx)) {
      excludedTreasuryCount += 1;
      continue;
    }
    if (!Number.isFinite(tx.amount) || tx.amount === 0) continue;
    const currency = tx.currencyCode || NO_CURRENCY;
    if (debit && !credit) add(ledger, currency, tx.amount);
    if (credit && !debit) add(ledger, currency, -tx.amount);
    if (debit && !credit && tx.amount > 0) {
      debits.push(tx);
      const linked =
        linkedTxIds.has(tx.documentId) ||
        (tx.relatedDocumentId != null && linkedTxIds.has(tx.relatedDocumentId));
      if (!linked) unlinkedDebits.push(tx);
    }
  }

  const unlinkedAssets: AssetReconciliationAsset[] = [];
  for (const asset of assets) {
    if (countsTowardBookValue(asset)) {
      add(assetTotals, asset.currencyCode || NO_CURRENCY, asset.purchasePrice!);
    } else if (needsLink(asset)) {
      unlinkedAssets.push(asset);
    }
  }

  const currencies = [
    ...new Set([...ledger.keys(), ...assetTotals.keys()]),
  ].sort((a, b) => a.localeCompare(b));
  const rows: AssetReconciliationCurrencyRow[] = currencies.map(
    (currencyCode) => {
      const ledgerBalance = roundAmount(ledger.get(currencyCode) ?? 0);
      const assetTotal = roundAmount(assetTotals.get(currencyCode) ?? 0);
      const difference = roundAmount(ledgerBalance - assetTotal);
      return {
        currencyCode,
        ledgerBalance,
        assetTotal,
        difference,
        matched: Math.abs(difference) < ASSET_RECONCILIATION_TOLERANCE,
      };
    },
  );

  unlinkedDebits.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const transactionMismatches = transactionLinkMismatches(debits, assets);
  unlinkedAssets.sort((a, b) => a.name.localeCompare(b.name, 'hu'));

  return {
    rows,
    unlinkedAssets,
    unlinkedDebits,
    transactionMismatches,
    excludedTreasuryCount,
    ok:
      rows.every((row) => row.matched) &&
      unlinkedAssets.length === 0 &&
      unlinkedDebits.length === 0 &&
      transactionMismatches.length === 0,
  };
}
