import { RoleGuard } from '../../auth/RoleGuard';
import { EmptyState } from '../EmptyState';

/** Create shell for dataentry; form fields arrive in plan step 6. */
export function TransactionCreate() {
  return (
    <RoleGuard allow={['dataentry']}>
      <EmptyState
        bodyKey="app.transactions_create_empty"
        titleKey="app.transactions_create"
      />
    </RoleGuard>
  );
}
