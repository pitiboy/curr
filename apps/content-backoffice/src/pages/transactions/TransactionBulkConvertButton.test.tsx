import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  TransactionRow,
  WorkflowTemplateHeader,
} from '../../data/transactionList';

const convertTransactionToWorkflow = vi.fn();
const notify = vi.fn();
const refresh = vi.fn();
const unselectAll = vi.fn();

type ConfirmProps = {
  isOpen?: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
  title?: string;
  content?: string;
};

let lastConfirm: ConfirmProps | null = null;

const useListContext = vi.fn();

const ugyelet1Template: WorkflowTemplateHeader = {
  documentId: 'wf-1',
  name: 'Ügylet 1',
  debit_account_code: 1520,
  credit_account_code: 1101,
  requires_source_organization: false,
};

const readyRow: TransactionRow = {
  id: 'doc-1',
  documentId: 'doc-1',
  status: 'draft',
  date: '2026-01-01',
  amount: 100,
  description: 'ok',
  debit_account: { code: '1520' },
  credit_account: { code: '1101' },
};

const convertedRow: TransactionRow = {
  ...readyRow,
  id: 'doc-2',
  documentId: 'doc-2',
  converted_to_workflow: 'expanded',
};

vi.mock('../../data/dataProvider', () => ({
  convertTransactionToWorkflow: (...args: unknown[]) =>
    convertTransactionToWorkflow(...args),
}));

vi.mock('../../workflows/useTransactionWorkflowCatalog', () => ({
  useTransactionWorkflowCatalog: () => ({
    workflows: [ugyelet1Template],
    loading: false,
  }),
  invalidateTransactionWorkflowCatalog: vi.fn(),
}));

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    useListContext: () => useListContext(),
    useNotify: () => notify,
    useRefresh: () => refresh,
    useUnselectAll: () => unselectAll,
    useTranslate: () => (key: string) => key,
    Confirm: (props: ConfirmProps) => {
      lastConfirm = props;
      if (!props.isOpen) return null;
      return (
        <div aria-label="bulk-convert-confirm" role="dialog">
          <span>{props.title}</span>
          <span>{props.content}</span>
          <button type="button" onClick={() => props.onClose?.()}>
            cancel
          </button>
          <button type="button" onClick={() => props.onConfirm?.()}>
            confirm
          </button>
        </div>
      );
    },
    Button: ({
      label,
      onClick,
      disabled,
      children,
    }: {
      label?: string;
      onClick?: (event: React.MouseEvent) => void;
      disabled?: boolean;
      children?: ReactNode;
    }) => (
      <button disabled={disabled} type="button" onClick={onClick}>
        {label}
        {children}
      </button>
    ),
  };
});

import { TransactionBulkConvertButton } from './TransactionBulkConvertButton';

describe('TransactionBulkConvertButton', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    lastConfirm = null;
  });

  beforeEach(() => {
    useListContext.mockReturnValue({
      selectedIds: [],
      data: [],
    });
  });

  it('uses the existing convert confirm label (Kifejtés key)', () => {
    render(<TransactionBulkConvertButton />);
    expect(
      screen.getByRole('button', { name: 'app.transactions_convert_confirm' }),
    ).toBeInTheDocument();
  });

  it('disables the button when nothing is selected (no convert, no confirm)', async () => {
    render(<TransactionBulkConvertButton />);
    const button = screen.getByRole('button', {
      name: 'app.transactions_convert_confirm',
    });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(lastConfirm?.isOpen).not.toBe(true);
    expect(convertTransactionToWorkflow).not.toHaveBeenCalled();
  });

  it('notifies skip reasons without opening confirm when none are ready', async () => {
    useListContext.mockReturnValue({
      selectedIds: ['doc-2'],
      data: [convertedRow],
    });

    render(<TransactionBulkConvertButton />);
    const button = screen.getByRole('button', {
      name: 'app.transactions_convert_confirm',
    });
    expect(button).toBeEnabled();
    await userEvent.click(button);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(convertTransactionToWorkflow).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      'app.transactions_bulk_convert_skipped_converted',
      expect.objectContaining({ type: 'warning' }),
    );
  });

  it('opens one bulk confirm with ready/skipped counts when some rows are ready', async () => {
    useListContext.mockReturnValue({
      selectedIds: ['doc-1', 'doc-2'],
      data: [readyRow, convertedRow],
    });

    render(<TransactionBulkConvertButton />);
    await userEvent.click(
      screen.getByRole('button', { name: 'app.transactions_convert_confirm' }),
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(lastConfirm?.title).toBe('app.transactions_bulk_convert_title');
    expect(lastConfirm?.content).toBe(
      'app.transactions_bulk_convert_body_partial',
    );
    expect(convertTransactionToWorkflow).not.toHaveBeenCalled();
  });

  it('converts ready rows sequentially, then unselects, refreshes, and notifies', async () => {
    useListContext.mockReturnValue({
      selectedIds: ['doc-1'],
      data: [readyRow],
    });
    convertTransactionToWorkflow.mockResolvedValue(undefined);

    render(<TransactionBulkConvertButton />);
    await userEvent.click(
      screen.getByRole('button', { name: 'app.transactions_convert_confirm' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }));

    await waitFor(() => {
      expect(convertTransactionToWorkflow).toHaveBeenCalledTimes(1);
    });
    expect(convertTransactionToWorkflow).toHaveBeenCalledWith('doc-1', 'wf-1');
    expect(unselectAll).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      'app.transactions_bulk_convert_done',
      expect.objectContaining({ type: 'success' }),
    );
  });
});
