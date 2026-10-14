import { EmptyState } from '../EmptyState';

/** Editor review shell; draft list and publish arrive in plan step 8. */
export function TransactionReview() {
  return (
    <EmptyState
      bodyKey="app.transactions_review_empty"
      titleKey="app.transactions_review"
    />
  );
}
