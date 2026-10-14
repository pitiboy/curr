import { EmptyState } from '../EmptyState';

/** Readonly list shell; data columns arrive in plan step 4. */
export function TransactionList() {
  return (
    <EmptyState
      bodyKey="app.transactions_list_empty"
      titleKey="app.transactions_list"
    />
  );
}
