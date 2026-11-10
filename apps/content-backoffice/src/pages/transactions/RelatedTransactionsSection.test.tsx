import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteTransaction, purgeExpansion } from '../../data/dataProvider';
import { RelatedTransactionsSection } from './RelatedTransactionsSection';

const permissionsState = { permissions: 'controller' as string };
const refresh = vi.fn();
const redirect = vi.fn();

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  const hu: Record<string, string> = {
    'app.transactions_show': 'Megnyitás',
    'app.transactions_delete_row': 'Törlés',
    'app.transactions_delete_row_title': 'Kifejtett sor törlése',
    'app.transactions_delete_row_body': 'A kifejtett sor törlődik.',
    'app.transactions_purge_expansion': 'Kifejtés törlése',
    'app.transactions_purge_expansion_title': 'Kifejtés törlése (megerősítés)',
    'app.transactions_purge_expansion_body': 'Minden kifejtett sor törlődik.',
    'app.transactions_delete_published_warning': 'Véglegesített sort törölsz.',
    'app.transactions_discard_confirm': 'Megerősít',
    'ra.action.cancel': 'Mégsem',
  };
  return {
    ...actual,
    useTranslate: () => (key: string) => hu[key] ?? key,
    usePermissions: () => ({
      permissions: permissionsState.permissions,
      isPending: false,
    }),
    useGetOne: () => ({ data: undefined, isPending: false }),
    useNotify: () => vi.fn(),
    useRefresh: () => refresh,
    useRedirect: () => redirect,
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    Confirm: ({
      isOpen,
      title,
      content,
      onConfirm,
    }: {
      isOpen: boolean;
      title: string;
      content: React.ReactNode;
      onConfirm: () => void;
    }) =>
      isOpen ? (
        <div role="dialog">
          <h2>{hu[title] ?? title}</h2>
          {content}
          <button onClick={onConfirm} type="button">
            Megerősít
          </button>
        </div>
      ) : null,
  };
});

vi.mock('./accountField', () => ({ AccountValue: () => null }));
vi.mock('./dateField', () => ({ TransactionDateValue: () => null }));
vi.mock('./DescriptionText', () => ({
  DescriptionText: ({ value }: { value: string }) => <span>{value}</span>,
}));

vi.mock('../../data/dataProvider', () => ({
  deleteTransaction: vi.fn(),
  purgeExpansion: vi.fn(),
}));

function originalRecord(status: 'draft' | 'published') {
  return {
    id: 'orig',
    status,
    converted_to_workflow: 'original',
    related_transactions: [
      { id: 2, documentId: 'storno', converted_to_workflow: 'storno' },
      { id: 3, documentId: 'step-1', converted_to_workflow: 'expanded' },
      { id: 4, documentId: 'step-2', converted_to_workflow: 'expanded' },
    ],
  };
}

function renderSection(record: Record<string, unknown>) {
  return render(
    <MemoryRouter>
      <RelatedTransactionsSection
        locale="hu"
        locales="hu-HU"
        record={record as never}
      />
    </MemoryRouter>,
  );
}

describe('RelatedTransactionsSection delete controls', () => {
  afterEach(() => {
    cleanup();
    permissionsState.permissions = 'controller';
    refresh.mockReset();
    redirect.mockReset();
    vi.mocked(deleteTransaction).mockReset();
    vi.mocked(purgeExpansion).mockReset();
  });

  it('hides delete controls for the editor role', () => {
    permissionsState.permissions = 'editor';
    renderSection(originalRecord('published'));
    expect(screen.queryByRole('button', { name: /Törlés/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Kifejtés törlése' }),
    ).toBeNull();
  });

  it('shows per-row delete on expanded rows only and the purge button for controller', () => {
    permissionsState.permissions = 'controller';
    renderSection(originalRecord('draft'));
    expect(screen.getAllByRole('button', { name: /^Törlés/ })).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Kifejtés törlése' }),
    ).toBeInTheDocument();
  });

  it('warns on published rows and deletes one expanded row', async () => {
    vi.mocked(deleteTransaction).mockResolvedValue(undefined);
    renderSection(originalRecord('published'));

    await userEvent.click(screen.getByRole('button', { name: 'Törlés 3' }));
    expect(screen.getByText('Véglegesített sort törölsz.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Megerősít' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(deleteTransaction).toHaveBeenCalledWith('step-1');
  });

  it('purges the expansion of the original without the published warning on drafts', async () => {
    vi.mocked(purgeExpansion).mockResolvedValue(undefined);
    renderSection(originalRecord('draft'));

    await userEvent.click(
      screen.getByRole('button', { name: 'Kifejtés törlése' }),
    );
    expect(screen.queryByText('Véglegesített sort törölsz.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Megerősít' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(purgeExpansion).toHaveBeenCalledWith('orig');
  });
});
