import { EmptyState } from '../EmptyState';

/** Create shell for dataentry; form fields arrive in plan step 6. */
export function TransactionCreate() {
  return (
    <EmptyState
      bodyKey="app.transactions_create_empty"
      titleKey="app.transactions_create"
    />
  );
}
