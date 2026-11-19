import { describe, expect, it } from 'vitest';

import {
  aggregateAssetReconciliation,
  isKorTreasuryTransaction,
  transactionLinkMismatches,
} from './assetReconciliation.aggregate';
import type {
  AssetReconciliationAsset,
  AssetReconciliationTransaction,
} from './types';

function tx(
  partial: Partial<AssetReconciliationTransaction> & { documentId: string },
): AssetReconciliationTransaction {
  return {
    date: '2026-03-01',
    amount: 100,
    description: '',
    debitCode: '1500',
    creditCode: '2000',
    currencyCode: 'HUF',
    relatedDocumentId: null,
    organizationName: 'Kert',
    ...partial,
  };
}

function asset(
  partial: Partial<AssetReconciliationAsset> & { documentId: string },
): AssetReconciliationAsset {
  return {
    name: partial.documentId,
    ownershipType: 'coop_owned',
    status: 'in_use',
    purchasePrice: 100,
    currencyCode: 'HUF',
    acquisitionTransactionId: null,
    organizationName: 'Kert',
    ...partial,
  };
}

describe('aggregateAssetReconciliation', () => {
  it('matches the 1500 balance with linked coop-owned assets per currency', () => {
    const report = aggregateAssetReconciliation(
      [
        tx({ documentId: 't1', amount: 150000 }),
        tx({ documentId: 't2', amount: 40, currencyCode: 'KOR' }),
      ],
      [
        asset({
          documentId: 'a1',
          purchasePrice: 150000,
          acquisitionTransactionId: 't1',
        }),
        asset({
          documentId: 'a2',
          purchasePrice: 40,
          currencyCode: 'KOR',
          acquisitionTransactionId: 't2',
        }),
      ],
    );
    expect(report.rows).toEqual([
      {
        currencyCode: 'HUF',
        ledgerBalance: 150000,
        assetTotal: 150000,
        difference: 0,
        matched: true,
      },
      {
        currencyCode: 'KOR',
        ledgerBalance: 40,
        assetTotal: 40,
        difference: 0,
        matched: true,
      },
    ]);
    expect(report.unlinkedAssets).toEqual([]);
    expect(report.unlinkedDebits).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('nets 1500 credits (disposal) against debits', () => {
    const report = aggregateAssetReconciliation(
      [
        tx({ documentId: 'buy', amount: 500 }),
        tx({
          documentId: 'sell',
          amount: 200,
          debitCode: '5800',
          creditCode: '1500',
        }),
      ],
      [
        asset({
          documentId: 'a',
          purchasePrice: 300,
          acquisitionTransactionId: 'buy',
        }),
      ],
    );
    expect(report.rows[0]).toMatchObject({
      ledgerBalance: 300,
      assetTotal: 300,
      matched: true,
    });
  });

  it('reports the difference and both kinds of mismatching items', () => {
    const report = aggregateAssetReconciliation(
      [
        tx({ documentId: 'linked', amount: 1000 }),
        tx({ documentId: 'orphan-debit', amount: 250, date: '2026-04-01' }),
      ],
      [
        asset({
          documentId: 'a-linked',
          purchasePrice: 1000,
          acquisitionTransactionId: 'linked',
        }),
        asset({ documentId: 'a-no-tx', purchasePrice: 99 }),
      ],
    );
    expect(report.rows[0]).toMatchObject({
      currencyCode: 'HUF',
      ledgerBalance: 1250,
      assetTotal: 1000,
      difference: 250,
      matched: false,
    });
    expect(report.unlinkedAssets.map((row) => row.documentId)).toEqual([
      'a-no-tx',
    ]);
    expect(report.unlinkedDebits.map((row) => row.documentId)).toEqual([
      'orphan-debit',
    ]);
    expect(report.ok).toBe(false);
  });

  it('treats an asset linked to the booked original as linking its 1500 leg', () => {
    const report = aggregateAssetReconciliation(
      [tx({ documentId: 'leg', relatedDocumentId: 'original', amount: 70 })],
      [
        asset({
          documentId: 'a',
          purchasePrice: 70,
          acquisitionTransactionId: 'original',
        }),
      ],
    );
    expect(report.unlinkedDebits).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('excludes disposed and non-coop-owned assets from the book value', () => {
    const report = aggregateAssetReconciliation(
      [tx({ documentId: 't', amount: 100 })],
      [
        asset({
          documentId: 'coop',
          purchasePrice: 100,
          acquisitionTransactionId: 't',
        }),
        asset({
          documentId: 'disposed',
          status: 'disposed',
          purchasePrice: 900,
          acquisitionTransactionId: 'other',
        }),
        asset({
          documentId: 'member',
          ownershipType: 'member_owned_lendable',
          purchasePrice: 500,
        }),
        asset({
          documentId: 'barter',
          ownershipType: 'barter',
          purchasePrice: 50,
        }),
        asset({ documentId: 'disposed-unlinked', status: 'disposed' }),
      ],
    );
    expect(report.rows).toEqual([
      expect.objectContaining({ assetTotal: 100, matched: true }),
    ]);
    // Only coop-owned, non-disposed assets need a transaction link.
    expect(report.unlinkedAssets).toEqual([]);
  });

  it('excludes KOR treasury (1100 in KOR) rows, keeps HUF rows on 1100', () => {
    expect(
      isKorTreasuryTransaction({
        debitCode: '1500',
        creditCode: '1100',
        currencyCode: 'KOR',
      }),
    ).toBe(true);
    expect(
      isKorTreasuryTransaction({
        debitCode: '1500',
        creditCode: '1100',
        currencyCode: 'HUF',
      }),
    ).toBe(false);

    const report = aggregateAssetReconciliation(
      [
        tx({
          documentId: 'treasury',
          creditCode: '1100',
          currencyCode: 'KOR',
          amount: 5000,
        }),
        tx({
          documentId: 'bank',
          creditCode: '1100',
          currencyCode: 'HUF',
          amount: 300,
        }),
      ],
      [
        asset({
          documentId: 'a',
          purchasePrice: 300,
          acquisitionTransactionId: 'bank',
        }),
      ],
    );
    expect(report.excludedTreasuryCount).toBe(1);
    expect(report.rows).toEqual([
      expect.objectContaining({ currencyCode: 'HUF', ledgerBalance: 300 }),
    ]);
    expect(report.unlinkedDebits).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('ignores rows that do not touch 1500', () => {
    const report = aggregateAssetReconciliation(
      [tx({ documentId: 'x', debitCode: '2000', creditCode: '1100' })],
      [],
    );
    expect(report.rows).toEqual([]);
    expect(report.ok).toBe(true);
  });
});

describe('transactionLinkMismatches', () => {
  it('accepts several assets that add up to one purchase', () => {
    const report = aggregateAssetReconciliation(
      [tx({ documentId: 't1', amount: 300 })],
      [
        asset({
          documentId: 'a1',
          purchasePrice: 100,
          acquisitionTransactionId: 't1',
        }),
        asset({
          documentId: 'a2',
          purchasePrice: 200,
          acquisitionTransactionId: 't1',
        }),
      ],
    );
    expect(report.transactionMismatches).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('flags a transaction linked twice (over-linked)', () => {
    const report = aggregateAssetReconciliation(
      [
        tx({ documentId: 't1', amount: 7878, description: 'Lapát' }),
        tx({ documentId: 't2', amount: 7878 }),
      ],
      [
        asset({
          documentId: 'a1',
          purchasePrice: 7878,
          acquisitionTransactionId: 't1',
        }),
        asset({
          documentId: 'a2',
          purchasePrice: 7878,
          acquisitionTransactionId: 't1',
        }),
      ],
    );
    expect(report.transactionMismatches).toEqual([
      expect.objectContaining({
        documentId: 't1',
        description: 'Lapát',
        amount: 7878,
        assetCount: 2,
        assetTotal: 15756,
        difference: 7878,
      }),
    ]);
    // Per currency the two errors cancel out — only the per-transaction table shows it.
    expect(report.rows[0]?.matched).toBe(true);
    expect(report.ok).toBe(false);
  });

  it('flags an under-linked purchase and an asset without a price', () => {
    const mismatches = transactionLinkMismatches(
      [tx({ documentId: 't1', amount: 300 })],
      [
        asset({
          documentId: 'a1',
          purchasePrice: null,
          acquisitionTransactionId: 't1',
        }),
      ],
    );
    expect(mismatches).toEqual([
      expect.objectContaining({ assetTotal: 0, difference: -300 }),
    ]);
  });

  it('resolves an asset linked to the original via its expanded 1500 legs', () => {
    const mismatches = transactionLinkMismatches(
      [
        tx({ documentId: 'leg1', amount: 200, relatedDocumentId: 'orig' }),
        tx({ documentId: 'leg2', amount: 100, relatedDocumentId: 'orig' }),
      ],
      [
        asset({
          documentId: 'a1',
          purchasePrice: 300,
          acquisitionTransactionId: 'orig',
        }),
      ],
    );
    expect(mismatches).toEqual([]);
  });

  it('skips transactions outside the filtered 1500 rows', () => {
    expect(
      transactionLinkMismatches(
        [],
        [asset({ documentId: 'a1', acquisitionTransactionId: 'elsewhere' })],
      ),
    ).toEqual([]);
  });
});
