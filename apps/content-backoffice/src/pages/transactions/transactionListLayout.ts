/**
 * Column keys omitted from the transaction list datagrid below the `sm`
 * breakpoint. Empty by default so every column stays visible (horizontal scroll).
 */
export const TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS: readonly string[] = [];

/** Full table min-width so mobile can scroll horizontally through every column. */
export function transactionListFooterMinWidth(
  _mobile: boolean,
  showBulkCheckbox: boolean,
): number | string {
  return showBulkCheckbox ? '55rem' : '52rem';
}

/**
 * Scrollport height for the datagrid wrapper so `position: sticky` headers work.
 * Reserves app bar, list padding, pagination, and the legal footer strip.
 */
export function transactionListScrollMaxHeight(mobile: boolean): string {
  return mobile ? 'calc(100dvh - 10.5rem)' : 'calc(100dvh - 12rem)';
}
