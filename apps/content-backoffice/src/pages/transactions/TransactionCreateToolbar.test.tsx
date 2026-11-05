import { cleanup, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../data/dataProvider', () => ({
  createNewTransactionDraft: vi.fn(),
  convertTransactionToWorkflow: vi.fn(),
}));

const usePermissions = vi.fn();
const useTransactionWorkflowCatalog = vi.fn();

const formValues = {
  date: '2026-01-01',
  amount: 10 as number | undefined,
  debit_account: 'debit-5200',
  credit_account: 'credit-1101',
  currency_type: 'cur-1',
  description: 'x',
};

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    usePermissions: () => usePermissions(),
    useTranslate: () => (key: string) => key,
    useNotify: () => vi.fn(),
    useRedirect: () => vi.fn(),
    SaveButton: ({ disabled }: { disabled?: boolean }) => (
      <button disabled={disabled} type="button">
        Mentés
      </button>
    ),
  };
});

vi.mock('../../workflows/useTransactionWorkflowCatalog', () => ({
  useTransactionWorkflowCatalog: () => useTransactionWorkflowCatalog(),
  invalidateTransactionWorkflowCatalog: vi.fn(),
}));

vi.mock('./TransactionConvertPreviewButton', () => ({
  TransactionConvertPreviewButton: ({ disabled }: { disabled?: boolean }) => (
    <button disabled={disabled} type="button">
      Preview
    </button>
  ),
}));

// Direct ConvertConfirmDialog → ConvertPreviewPanel → useConvertPreview → ra-strapi.
// ra-strapi's CJS build fails under Vitest ESM; Gate test uses the same stub.
vi.mock('../../workflows/useConvertPreview', () => ({
  useConvertPreview: () => ({
    preview: null,
    loading: false,
    error: null,
  }),
}));

vi.mock('react-hook-form', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-hook-form')>();
  return {
    ...actual,
    useWatch: (args?: { name?: string }) => {
      const name = args?.name;
      if (name === 'debit_account') return formValues.debit_account;
      if (name === 'credit_account') return formValues.credit_account;
      if (name === 'currency_type') return formValues.currency_type;
      if (name === 'transaction_type') return undefined;
      if (name === undefined) return { ...formValues };
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
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    formValues.amount = 10;
    formValues.description = 'x';
    usePermissions.mockReturnValue({ permissions: 'editor', isPending: false });
    useTransactionWorkflowCatalog.mockReturnValue({
      workflows: [workflow],
      loading: false,
      matchFor: () => null,
      isEditor: true,
    });
  });

  it('shows convert actions for an active selected workflow template', () => {
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
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Mentés' })).toBeEnabled();
  });

  it('disables save and convert while amount or description is empty', () => {
    formValues.amount = undefined;
    formValues.description = '';

    render(
      <ToolbarShell
        storedSelection={{
          kind: 'workflow',
          workflowDocumentId: 'wf-selected',
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Mentés' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'app.transactions_convert_save' }),
    ).toBeDisabled();
  });
});
