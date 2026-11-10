import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteTransaction, purgeExpansion } from '../../data/dataProvider';
import { RelatedTransactionsSection } from './RelatedTransactionsSection';

const permissionsState = { permissions: 'controller' as string };
const refresh = vi.fn();
const redirect = vi.fn();
const notify = vi.fn();
const getOneState: { data: Record<string, unknown> | undefined } = {
  data: undefined,
};

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  const hu: Record<string, string> = {
    'app.transactions_show': 'Megnyitás',
    'app.transactions_delete_row': 'Törlés',
    'app.transactions_delete_row_title': 'Kifejtett sor törlése',
    'app.transactions_delete_row_body': 'A kifejtett sor törlődik.',
    'app.transactions_purge_expansion': 'Kifejtett sorok törlése',
    'app.transactions_purge_expansion_title': 'Kifejtés törlése (megerősítés)',
    'app.transactions_purge_expansion_body': 'Minden kifejtett sor törlődik.',
    'app.transactions_purge_expansion_rows_body':
      'A kifejtett sorok törlődnek.',
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
    useGetOne: () => ({ data: getOneState.data, isPending: false }),
    useNotify: () => notify,
    useRefresh: () => refresh,
    useRedirect: () => redirect,
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    Confirm: ({
      isOpen,
      title,
      content,
      onConfirm,
      onClose,
    }: {
      isOpen: boolean;
      title: string;
      content: React.ReactNode;
      onConfirm: () => void;
      onClose: () => void;
    }) =>
      isOpen ? (
        <div role="dialog">
          <h2>{hu[title] ?? title}</h2>
          {content}
          <button onClick={onConfirm} type="button">
            Megerősít
          </button>
          <button onClick={onClose} type="button">
            Mégsem
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

/** Per-row delete buttons that can be clicked (blocked rows are disabled). */
function enabledRowDeletes() {
  return screen
    .queryAllByRole('button', { name: /^Törlés/ })
    .filter((button) => !(button as HTMLButtonElement).disabled);
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
    notify.mockReset();
    getOneState.data = undefined;
    vi.mocked(deleteTransaction).mockReset();
    vi.mocked(purgeExpansion).mockReset();
  });

  it('hides delete controls for the editor role', () => {
    permissionsState.permissions = 'editor';
    renderSection(originalRecord('published'));
    expect(screen.queryByRole('button', { name: /Törlés/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Kifejtett sorok törlése/ }),
    ).toBeNull();
  });

  it('shows per-row delete on expanded rows only and the purge button for controller', () => {
    permissionsState.permissions = 'controller';
    renderSection(originalRecord('draft'));
    // Original (self) and storno are listed but disabled while expanded rows remain.
    expect(screen.getAllByRole('button', { name: /^Törlés/ })).toHaveLength(4);
    expect(enabledRowDeletes()).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: /Kifejtett sorok törlése/ }),
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
      screen.getByRole('button', { name: /Kifejtett sorok törlése/ }),
    );
    expect(screen.queryByText('Véglegesített sort törölsz.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Megerősít' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(purgeExpansion).toHaveBeenCalledWith('orig');
  });

  it('hides delete controls for the dataentry role', () => {
    permissionsState.permissions = 'dataentry';
    renderSection(originalRecord('draft'));
    expect(screen.queryByRole('button', { name: /Törlés/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Kifejtett sorok törlése/ }),
    ).toBeNull();
  });

  it('cancel closes the dialog without calling the API', async () => {
    renderSection(originalRecord('draft'));
    await userEvent.click(screen.getByRole('button', { name: 'Törlés 4' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mégsem' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(deleteTransaction).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('notifies the server error and keeps the page on failed row delete', async () => {
    vi.mocked(deleteTransaction).mockRejectedValue(
      new Error(
        'The storno row can only be deleted after every expanded row is deleted',
      ),
    );
    renderSection(originalRecord('draft'));
    await userEvent.click(screen.getByRole('button', { name: 'Törlés 3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Megerősít' }));

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        'The storno row can only be deleted after every expanded row is deleted',
        { type: 'error' },
      ),
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('falls back to the translated error key when the purge error has no message', async () => {
    vi.mocked(purgeExpansion).mockRejectedValue({});
    renderSection(originalRecord('published'));
    await userEvent.click(
      screen.getByRole('button', { name: /Kifejtett sorok törlése/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Megerősít' }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        'app.transactions_purge_expansion_error',
        { type: 'error' },
      ),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('notifies success after a purge', async () => {
    vi.mocked(purgeExpansion).mockResolvedValue(undefined);
    renderSection(originalRecord('draft'));
    await userEvent.click(
      screen.getByRole('button', { name: /Kifejtett sorok törlése/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Megerősít' }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        'app.transactions_purge_expansion_done',
        { type: 'success' },
      ),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  describe('on an expanded child Show', () => {
    function childRecord() {
      return {
        id: 'step-1',
        status: 'draft',
        converted_to_workflow: 'expanded',
        related_transaction: { documentId: 'orig' },
      };
    }

    function loadParent() {
      getOneState.data = {
        id: 1,
        documentId: 'orig',
        converted_to_workflow: 'original',
        related_transactions: [
          { id: 2, documentId: 'storno', converted_to_workflow: 'storno' },
          { id: 3, documentId: 'step-1', converted_to_workflow: 'expanded' },
          { id: 4, documentId: 'step-2', converted_to_workflow: 'expanded' },
        ],
      };
    }

    it('deleting the shown row redirects to the list', async () => {
      loadParent();
      vi.mocked(deleteTransaction).mockResolvedValue(undefined);
      renderSection(childRecord());
      await userEvent.click(screen.getByRole('button', { name: 'Törlés 3' }));
      await userEvent.click(screen.getByRole('button', { name: 'Megerősít' }));
      await waitFor(() =>
        expect(redirect).toHaveBeenCalledWith('list', 'transactions'),
      );
      expect(refresh).not.toHaveBeenCalled();
    });

    it('deleting a sibling only refreshes', async () => {
      loadParent();
      vi.mocked(deleteTransaction).mockResolvedValue(undefined);
      renderSection(childRecord());
      await userEvent.click(screen.getByRole('button', { name: 'Törlés 4' }));
      await userEvent.click(screen.getByRole('button', { name: 'Megerősít' }));
      await waitFor(() => expect(refresh).toHaveBeenCalled());
      expect(deleteTransaction).toHaveBeenCalledWith('step-2');
      expect(redirect).not.toHaveBeenCalled();
    });

    it('purging from a child redirects to the original Show', async () => {
      loadParent();
      vi.mocked(purgeExpansion).mockResolvedValue(undefined);
      renderSection(childRecord());
      await userEvent.click(
        screen.getByRole('button', { name: /Kifejtett sorok törlése/ }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Megerősít' }));
      await waitFor(() =>
        expect(redirect).toHaveBeenCalledWith('show', 'transactions', 'orig'),
      );
      expect(purgeExpansion).toHaveBeenCalledWith('orig');
    });
  });

  it('only storno left: storno deletable, original blocked until then', () => {
    renderSection({
      id: 'orig',
      status: 'draft',
      converted_to_workflow: 'original',
      related_transactions: [
        { id: 2, documentId: 'storno', converted_to_workflow: 'storno' },
      ],
    });
    expect(enabledRowDeletes()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Törlés 2' })).not.toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Kifejtett sorok törlése/ }),
    ).toBeInTheDocument();
  });

  it('deletes a non-expanded row with the generic title', async () => {
    vi.mocked(deleteTransaction).mockResolvedValue(undefined);
    renderSection({
      id: 'plain',
      status: 'published',
      related_transactions: [
        { id: 9, documentId: 'x', converted_to_workflow: null },
      ],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Törlés 9' }));
    expect(
      screen.getByRole('heading', {
        name: 'app.transactions_delete_any_row_title',
      }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Megerősít' }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        'app.transactions_delete_any_row_done',
        { type: 'success' },
      ),
    );
    expect(deleteTransaction).toHaveBeenCalledWith('x');
  });

  describe('on a bulk-entry group (anchor is not an original)', () => {
    function loadAnchor() {
      getOneState.data = {
        id: 1,
        documentId: 'anchor',
        converted_to_workflow: null,
        related_transactions: [
          { id: 5, documentId: 'leg-1', converted_to_workflow: null },
          {
            id: 6,
            documentId: 'leg-2',
            converted_to_workflow: 'expanded',
            description: 'Tojás eladás (bevétel)',
            amount: 600,
          },
        ],
      };
    }

    const legRecord = {
      id: 'leg-1',
      status: 'published',
      converted_to_workflow: null,
      related_transaction: { documentId: 'anchor' },
    };

    it('offers the group purge and lists the rows in the confirm', async () => {
      loadAnchor();
      vi.mocked(purgeExpansion).mockResolvedValue(undefined);
      renderSection(legRecord);
      // Only the expanded leg is deletable while it remains.
      expect(enabledRowDeletes()).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Törlés 6' })).toBeEnabled();
      await userEvent.click(
        screen.getByRole('button', { name: /Kifejtett sorok törlése/ }),
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('A kifejtett sorok törlődnek.');
      expect(dialog).toHaveTextContent('Tojás eladás (bevétel)');
      await userEvent.click(screen.getByRole('button', { name: 'Megerősít' }));
      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith(
          'app.transactions_purge_expansion_rows_done',
          { type: 'success' },
        ),
      );
      expect(purgeExpansion).toHaveBeenCalledWith('anchor');
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('a non-expanded group offers no purge but per-row delete', () => {
    renderSection({
      id: 'plain',
      status: 'draft',
      converted_to_workflow: null,
      related_transactions: [
        { id: 9, documentId: 'x', converted_to_workflow: null },
      ],
    });
    expect(
      screen.queryByRole('button', { name: /Kifejtett sorok törlése/ }),
    ).toBeNull();
    expect(enabledRowDeletes()).toHaveLength(2);
  });
});
