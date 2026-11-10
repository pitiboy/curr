import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const usePermissions = vi.fn();

vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => false,
}));

vi.mock('../../auth/roles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/roles')>();
  return actual;
});

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    usePermissions: () => usePermissions(),
    useLocaleState: () => ['hu'],
    useTranslate: () => (key: string) => key,
    useListContext: () => ({ selectedIds: [], data: [] }),
    useNotify: () => vi.fn(),
    useRefresh: () => vi.fn(),
    useUnselectAll: () => vi.fn(),
    List: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="list">{children}</div>
    ),
    Datagrid: ({
      bulkActionButtons,
    }: {
      bulkActionButtons?: React.ReactNode | false;
    }) => <div data-testid="datagrid-bulk-actions">{bulkActionButtons}</div>,
    FilterButton: () => null,
    useRecordContext: () => undefined,
    FunctionField: () => null,
    TextField: () => null,
    NumberField: () => null,
    SelectField: () => null,
    DateInput: () => null,
    TextInput: () => null,
    NumberInput: () => null,
    SelectInput: () => null,
    SelectArrayInput: () => null,
    ReferenceInput: () => null,
    AutocompleteInput: () => null,
    Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Button: ({
      label,
      children,
    }: {
      label?: string;
      children?: React.ReactNode;
    }) => <button type="button">{label ?? children}</button>,
    Confirm: () => null,
    TopToolbar: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

vi.mock('../../workflows/useTransactionWorkflowCatalog', () => ({
  useTransactionWorkflowCatalog: () => ({ workflows: [], loading: false }),
  invalidateTransactionWorkflowCatalog: vi.fn(),
}));

vi.mock('../../data/dataProvider', () => ({
  publishTransaction: vi.fn(),
  convertTransactionToWorkflow: vi.fn(),
}));

vi.mock('../../auth/authProvider', () => ({
  fetchProfileFields: vi
    .fn()
    .mockResolvedValue({ email: 'editor@example.com' }),
}));

vi.mock('../../workflows/useBackofficeConfig', () => ({
  useBackofficeConfig: () => ({ publisherMustDiffer: true }),
}));

vi.mock('../../filters/TransactionListFilterBridge', () => ({
  TransactionListFilterBridge: () => null,
}));

vi.mock('./TransactionConvertField', () => ({
  TransactionConvertField: () => null,
}));

vi.mock('./accountField', () => ({
  AccountFieldLabel: () => null,
  AccountValue: () => null,
}));

vi.mock('./currencyField', () => ({
  CurrencyValue: () => null,
}));

vi.mock('./dateField', () => ({
  TransactionDateValue: () => null,
}));

vi.mock('./DescriptionText', () => ({
  DescriptionText: () => null,
}));

vi.mock('../../filters/TransactionListFilterBridge', () => ({
  TransactionListFilterBridge: () => null,
}));

import { TransactionList } from './TransactionList';

describe('TransactionList bulk actions', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    usePermissions.mockReturnValue({
      permissions: 'dataentry',
      isPending: false,
    });
  });

  it('hides bulk finalize and convert buttons for non-editor roles', () => {
    render(<TransactionList />);
    expect(screen.getByTestId('datagrid-bulk-actions')).toBeEmptyDOMElement();
  });

  it('shows bulk finalize and convert buttons for editor-like roles', () => {
    usePermissions.mockReturnValue({ permissions: 'editor', isPending: false });
    render(<TransactionList />);
    expect(
      screen.getByRole('button', { name: 'app.transactions_bulk_finalize' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'app.transactions_convert_confirm' }),
    ).toBeInTheDocument();
  });
});
