import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../data/dataProvider', () => ({
  createNewTransactionDraft: vi.fn(),
  convertTransactionToWorkflow: vi.fn(),
}));

const usePermissions = vi.fn();
const useTransactionWorkflowCatalog = vi.fn();

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    usePermissions: () => usePermissions(),
    useTranslate: () => (key: string) => key,
    useNotify: () => vi.fn(),
    useRedirect: () => vi.fn(),
    SaveButton: () => <button type="button">Mentés</button>,
  };
});

vi.mock('../../workflows/useTransactionWorkflowCatalog', () => ({
  useTransactionWorkflowCatalog: () => useTransactionWorkflowCatalog(),
  invalidateTransactionWorkflowCatalog: vi.fn(),
}));

vi.mock('./TransactionConvertPreviewButton', () => ({
  TransactionConvertPreviewButton: () => <button type="button">Preview</button>,
}));

vi.mock('react-hook-form', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-hook-form')>();
  return {
    ...actual,
    useWatch: (args?: { name?: string }) => {
      const name = args?.name;
      if (name === 'debit_account') return 'debit-5200';
      if (name === 'credit_account') return 'credit-1101';
      if (name === 'currency_type') return 'cur-1';
      if (name === 'transaction_type') return undefined;
      if (name === undefined) {
        return {
          date: '2026-01-01',
          amount: 10,
          debit_account: 'debit-5200',
          credit_account: 'credit-1101',
          currency_type: 'cur-1',
          description: 'x',
        };
      }
      return undefined;
    },
  };
});

import { TransactionCreateToolbar } from './TransactionCreateToolbar';
import {
  TransactionCreateAccountRowFormSync,
  TransactionCreateAccountRowProvider,
} from './TransactionCreateAccountRowContext';

const accounts = [
  { id: 'credit-1101', code: '1101', name: 'Bank' },
  { id: 'debit-5200', code: '5200', name: 'Cost' },
];

const workflow = {
  documentId: 'wf-selected',
  name: 'Selected',
  debit_account_code: 5200,
  credit_account_code: 1101,
};

function ToolbarShell({
  storedSelection,
}: {
  storedSelection:
    | { kind: 'profile'; profile: 'cost' }
    | { kind: 'workflow'; workflowDocumentId: string };
}) {
  const methods = useForm();
  return (
    <TransactionCreateAccountRowProvider
      accounts={accounts}
      defaultProfile="cost"
      initialStoredSelection={storedSelection}
      transactionWorkflows={[workflow]}
    >
      <FormProvider {...methods}>
        <TransactionCreateAccountRowFormSync />
        <TransactionCreateToolbar
          accounts={accounts}
          receiptCards={[]}
          onSaveSucceeded={() => undefined}
        />
      </FormProvider>
    </TransactionCreateAccountRowProvider>
  );
}

describe('TransactionCreateToolbar', () => {
  it('shows convert actions for an active selected workflow template', () => {
    usePermissions.mockReturnValue({ permissions: 'editor', isPending: false });
    useTransactionWorkflowCatalog.mockReturnValue({
      workflows: [workflow],
      loading: false,
      matchFor: () => null,
      isEditor: true,
    });

    render(
      <ToolbarShell
        storedSelection={{
          kind: 'workflow',
          workflowDocumentId: 'wf-selected',
        }}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'app.transactions_convert_save' }),
    ).toBeVisible();
  });
});
