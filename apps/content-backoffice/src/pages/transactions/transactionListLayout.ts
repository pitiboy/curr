/** Column keys omitted from the transaction list datagrid below the `sm` breakpoint. */
export const TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS = [
  'entryId',
  'vendor',
  'converted_to_workflow',
  'organization',
  'credit',
  'debit',
  'receipts',
  'createdAt',
  'entered_by',
  'published_by',
  'publishedAt',
] as const;

export function transactionListFooterMinWidth(
  mobile: boolean,
  showBulkCheckbox: boolean,
): number | string {
  return mobile ? (showBulkCheckbox ? '30rem' : '27rem') : '52rem';
}
