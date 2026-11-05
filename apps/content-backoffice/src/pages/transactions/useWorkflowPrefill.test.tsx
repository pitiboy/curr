import { render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AccountChoice } from '../../data/accountCodes';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import {
  TransactionCreateAccountRowFormSync,
  TransactionCreateAccountRowProvider,
  useTransactionCreateAccountRow,
} from './TransactionCreateAccountRowContext';
import { useWorkflowPrefillOnSelect } from './useWorkflowPrefill';

const accounts: AccountChoice[] = [
  { id: 'credit-1101-a', code: '1101', name: 'Bank A' },
  { id: 'credit-1101-b', code: '1101', name: 'Bank B' },
  { id: 'credit-1300', code: '1300', name: 'Készlet' },
  { id: 'debit-5200', code: '5200', name: 'Cost' },
];

const workflowAmbiguous: WorkflowTemplateHeader = {
  documentId: 'wf-ambiguous',
  name: 'Ambiguous credit',
  debit_account_code: 5200,
  credit_account_code: 1101,
};

function PrefillProbe() {
  const { watch } = useFormContext();
  const { storedSelection } = useTransactionCreateAccountRow();
  const { prefillWarningKeys, accountCodeFilters } = useWorkflowPrefillOnSelect(
    accounts,
    [workflowAmbiguous],
  );

  return (
    <div>
      <div data-testid="selection-kind">{storedSelection.kind}</div>
      <div data-testid="debit">{String(watch('debit_account') ?? '')}</div>
      <div data-testid="credit">{String(watch('credit_account') ?? '')}</div>
      <div data-testid="credit-filter">
        {accountCodeFilters.credit ?? ''}
      </div>
      <div data-testid="warnings">{prefillWarningKeys.join(',')}</div>
    </div>
  );
}

describe('useWorkflowPrefillOnSelect', () => {
  it('clears ambiguous accounts, keeps the template, and exposes a code filter', async () => {
    const Wrapper = ({ children }: { children: React.ReactNode }) => {
      const methods = useForm({
        defaultValues: {
          debit_account: 'debit-5200',
          credit_account: 'credit-1300',
          currency_type: '',
        },
      });
      return (
        <TransactionCreateAccountRowProvider
          accounts={accounts}
          defaultProfile="cost"
          initialStoredSelection={{
            kind: 'workflow',
            workflowDocumentId: 'wf-ambiguous',
          }}
          transactionWorkflows={[workflowAmbiguous]}
        >
          <FormProvider {...methods}>
            <TransactionCreateAccountRowFormSync />
            {children}
          </FormProvider>
        </TransactionCreateAccountRowProvider>
      );
    };

    render(
      <Wrapper>
        <PrefillProbe />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('warnings').textContent).toBe(
        'app.account_profile_workflow_prefill_incomplete',
      );
    });
    expect(screen.getByTestId('selection-kind').textContent).toBe('workflow');
    expect(screen.getByTestId('debit').textContent).toBe('debit-5200');
    expect(screen.getByTestId('credit').textContent).toBe('');
    expect(screen.getByTestId('credit-filter').textContent).toBe('1101');
  });
});
