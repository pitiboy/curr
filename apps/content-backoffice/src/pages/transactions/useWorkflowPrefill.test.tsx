import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';

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
  requires_source_organization: false,
};

const workflowWithType: WorkflowTemplateHeader = {
  documentId: 'wf-typed',
  name: 'Typed',
  debit_account_code: 5200,
  credit_account_code: 1300,
  transaction_type: { documentId: 'type-tpl', name: 'Sablon típus' },
  requires_source_organization: false,
};

const workflowWithCurrency: WorkflowTemplateHeader = {
  documentId: 'wf-egg',
  name: 'Egg pair',
  debit_account_code: 5200,
  credit_account_code: 1300,
  currency_type: { documentId: 'cur-egg', code: 'EGG', name: 'Tojás' },
  requires_source_organization: false,
};

function PrefillProbe({ workflows }: { workflows: WorkflowTemplateHeader[] }) {
  const { watch } = useFormContext();
  const { storedSelection } = useTransactionCreateAccountRow();
  const { prefillWarningKeys, accountCodeFilters } = useWorkflowPrefillOnSelect(
    accounts,
    workflows,
  );

  return (
    <div>
      <div data-testid="selection-kind">{storedSelection.kind}</div>
      <div data-testid="debit">{String(watch('debit_account') ?? '')}</div>
      <div data-testid="credit">{String(watch('credit_account') ?? '')}</div>
      <div data-testid="currency">{String(watch('currency_type') ?? '')}</div>
      <div data-testid="type">{String(watch('transaction_type') ?? '')}</div>
      <div data-testid="credit-filter">{accountCodeFilters.credit ?? ''}</div>
      <div data-testid="warnings">{prefillWarningKeys.join(',')}</div>
    </div>
  );
}

describe('useWorkflowPrefillOnSelect', () => {
  afterEach(() => {
    cleanup();
  });

  it('clears ambiguous accounts, keeps the template, and exposes a code filter', async () => {
    const Wrapper = ({ children }: { children: React.ReactNode }) => {
      const methods = useForm({
        defaultValues: {
          debit_account: 'debit-5200',
          credit_account: 'credit-1300',
          currency_type: 'cur-huf',
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
        <PrefillProbe workflows={[workflowAmbiguous]} />
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
    expect(screen.getByTestId('currency').textContent).toBe('');
  });

  it('prefills currency when the template has one', async () => {
    const Wrapper = ({ children }: { children: React.ReactNode }) => {
      const methods = useForm({
        defaultValues: {
          debit_account: '',
          credit_account: '',
          currency_type: 'cur-huf',
        },
      });
      return (
        <TransactionCreateAccountRowProvider
          accounts={accounts}
          defaultProfile="cost"
          initialStoredSelection={{
            kind: 'workflow',
            workflowDocumentId: 'wf-egg',
          }}
          transactionWorkflows={[workflowWithCurrency]}
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
        <PrefillProbe workflows={[workflowWithCurrency]} />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('currency').textContent).toBe('cur-egg');
    });
    expect(screen.getByTestId('debit').textContent).toBe('debit-5200');
    expect(screen.getByTestId('credit').textContent).toBe('credit-1300');
  });

  it('prefills the template type, and a manual type change survives the drop', async () => {
    let form: ReturnType<typeof useForm> | null = null;
    const Wrapper = ({ children }: { children: React.ReactNode }) => {
      const methods = useForm({
        defaultValues: {
          debit_account: '',
          credit_account: '',
          currency_type: '',
          transaction_type: undefined as string | undefined,
        },
      });
      form = methods as unknown as ReturnType<typeof useForm>;
      return (
        <TransactionCreateAccountRowProvider
          accounts={accounts}
          defaultProfile="cost"
          initialStoredSelection={{
            kind: 'workflow',
            workflowDocumentId: 'wf-typed',
          }}
          transactionWorkflows={[workflowWithType]}
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
        <PrefillProbe workflows={[workflowWithType]} />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('type').textContent).toBe('type-tpl');
    });
    expect(screen.getByTestId('selection-kind').textContent).toBe('workflow');

    act(() => {
      form?.setValue('transaction_type', 'type-manual');
    });

    await waitFor(() => {
      expect(screen.getByTestId('selection-kind').textContent).toBe('profile');
    });
    expect(screen.getByTestId('type').textContent).toBe('type-manual');
  });
});
