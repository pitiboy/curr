import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import type { AccountChoice } from '../../data/accountCodes';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import {
  TransactionCreateAccountRowFormSync,
  TransactionCreateAccountRowProvider,
} from './TransactionCreateAccountRowContext';
import { TransactionAccountProfileRow } from './TransactionAccountProfileRow';

const accounts: AccountChoice[] = [
  { id: 'credit-1101', code: '1101', name: 'Bank' },
  { id: 'debit-5200', code: '5200', name: 'Cost' },
];

const workflow: WorkflowTemplateHeader = {
  documentId: 'wf-1',
  name: 'Seed pair',
  debit_account_code: 5200,
  credit_account_code: 1101,
};

vi.mock('../../workflows/useBackofficeConfig', () => ({
  useBackofficeConfig: () => ({ enabled: [], ready: true }),
}));

vi.mock('../../workflows/useAccountCodePatterns', () => ({
  useAccountCodePatterns: () => ({
    debit: /^5/,
    credit: /^(1|3)/,
  }),
}));

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    useTranslate: () => (key: string) => key,
    AutocompleteInput: ({
      source,
      choices,
    }: {
      source: string;
      choices: { id: string; name: string }[];
    }) => {
      const { watch } = useFormContext();
      const value = watch(source);
      return (
        <select
          aria-label={source}
          data-testid={source}
          value={typeof value === 'string' ? value : ''}
        >
          {choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.name}
            </option>
          ))}
        </select>
      );
    },
    required: () => undefined,
  };
});

function FormShell({
  children,
  withWorkflowTemplates,
}: {
  children: React.ReactNode;
  withWorkflowTemplates: boolean;
}) {
  const methods = useForm({
    defaultValues: {
      debit_account: '',
      credit_account: '',
      currency_type: '',
    },
  });
  const inner = (
    <FormProvider {...methods}>
      {withWorkflowTemplates ? <TransactionCreateAccountRowFormSync /> : null}
      {children}
    </FormProvider>
  );
  if (!withWorkflowTemplates) {
    return inner;
  }
  return (
    <TransactionCreateAccountRowProvider
      accounts={accounts}
      defaultProfile="cost"
      transactionWorkflows={[workflow]}
    >
      {inner}
    </TransactionCreateAccountRowProvider>
  );
}

describe('TransactionAccountProfileRow', () => {
  it('keeps the legacy profile-only select on Review (no template group)', async () => {
    render(
      <FormShell withWorkflowTemplates={false}>
        <TransactionAccountProfileRow
          accounts={accounts}
          defaultProfile=""
          failed={false}
          isPending={false}
        />
      </FormShell>,
    );
    const select = screen.getByLabelText('app.account_profile');
    await userEvent.click(select);
    expect(
      screen.queryByText('app.account_profile_group_workflows'),
    ).toBeNull();
  });

  it('lists transaction templates in a second group on Create', async () => {
    render(
      <FormShell withWorkflowTemplates={true}>
        <TransactionAccountProfileRow
          accounts={accounts}
          defaultProfile="cost"
          failed={false}
          isPending={false}
          transactionWorkflowTemplates={[workflow]}
        />
      </FormShell>,
    );
    const select = screen.getByRole('combobox', {
      name: 'app.account_profile',
    });
    await userEvent.click(select);
    const listbox = await screen.findByRole('listbox');
    expect(
      within(listbox).getByText('app.account_profile_group_workflows'),
    ).toBeVisible();
    expect(
      within(listbox).getByText('Seed pair', { exact: false }),
    ).toBeVisible();
  });
});
