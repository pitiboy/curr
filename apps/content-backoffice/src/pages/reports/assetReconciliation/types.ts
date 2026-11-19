export type AssetReconciliationTransaction = {
  documentId: string;
  date: string | null;
  amount: number;
  description: string;
  debitCode: string;
  creditCode: string;
  currencyCode: string;
  /** `related_transaction` (the booked original of an expanded leg). */
  relatedDocumentId: string | null;
  organizationName: string;
};

export type AssetReconciliationAsset = {
  documentId: string;
  name: string;
  ownershipType: string | null;
  status: string | null;
  purchasePrice: number | null;
  currencyCode: string;
  acquisitionTransactionId: string | null;
  organizationName: string;
};

export type AssetReconciliationCurrencyRow = {
  currencyCode: string;
  /** 1500 balance from transactions (debit − credit). */
  ledgerBalance: number;
  /** Σ purchase_price of coop-owned, non-disposed, transaction-linked assets. */
  assetTotal: number;
  /** ledgerBalance − assetTotal. */
  difference: number;
  matched: boolean;
};

/** One acquisition transaction whose linked assets do not add up to it. */
export type AssetReconciliationTransactionMismatch = {
  documentId: string;
  date: string | null;
  description: string;
  currencyCode: string;
  /** 1500 debit of the transaction (Σ of its expanded 1500 legs for an original). */
  amount: number;
  assetCount: number;
  /** Σ purchase_price of the assets linked to it (missing price = 0). */
  assetTotal: number;
  /** assetTotal − amount (positive = over-linked). */
  difference: number;
};

export type AssetReconciliationReport = {
  rows: AssetReconciliationCurrencyRow[];
  /** Coop-owned, non-disposed assets without an acquisition transaction. */
  unlinkedAssets: AssetReconciliationAsset[];
  /** 1500 debit rows that no asset links to (directly or via the original). */
  unlinkedDebits: AssetReconciliationTransaction[];
  /** Acquisition transactions where Σ linked purchase prices ≠ the 1500 debit. */
  transactionMismatches: AssetReconciliationTransactionMismatch[];
  /** Rows dropped by the KOR treasury rule. */
  excludedTreasuryCount: number;
  ok: boolean;
};
