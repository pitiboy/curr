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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function add(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
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
      const ledgerBalance = round2(ledger.get(currencyCode) ?? 0);
      const assetTotal = round2(assetTotals.get(currencyCode) ?? 0);
      const difference = round2(ledgerBalance - assetTotal);
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
  unlinkedAssets.sort((a, b) => a.name.localeCompare(b.name, 'hu'));

  return {
    rows,
    unlinkedAssets,
    unlinkedDebits,
    excludedTreasuryCount,
    ok:
      rows.every((row) => row.matched) &&
      unlinkedAssets.length === 0 &&
      unlinkedDebits.length === 0,
  };
}
