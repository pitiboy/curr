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
