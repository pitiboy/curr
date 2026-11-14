import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearTestPendingChangeUser,
  setTestPendingChangeUser,
} from '../../data/pendingChanges/currentUser';
import {
  resetPendingChangesPersistenceForTests,
  configureLocalStoragePersistenceForTests,
} from '../../data/pendingChanges/persistence';
import { enqueuePendingChange } from '../../data/pendingChanges/store';

import { PendingChangesPage } from './PendingChangesPage';

vi.mock('react-admin', async () => {
  const actual =
    await vi.importActual<typeof import('react-admin')>('react-admin');
  return {
    ...actual,
    Title: ({ title }: { title: string }) => (
      <div data-testid="title">{title}</div>
    ),
    useDataProvider: () => ({
      update: vi.fn(),
    }),
    useRefresh: () => vi.fn(),
    useTranslate: () => (key: string) => {
      const map: Record<string, string> = {
        'app.pending_changes.title': 'Kiküldésre váró módosítások',
        'app.pending_changes.empty': 'Nincs kiküldésre váró módosítás.',
        'app.pending_changes.retry': 'Újraküldés',
        'app.pending_changes.retry_all': 'Összes újraküldése',
        'app.pending_changes.discard': 'Elvetés',
        'app.pending_changes.discard_title': 'Elvetés megerősítése',
        'app.pending_changes.discard_body': 'Biztosan elveted?',
        'app.pending_changes.col_time': 'Időpont',
        'app.pending_changes.col_resource': 'Erőforrás',
        'app.pending_changes.col_operation': 'Művelet',
        'app.pending_changes.col_summary': 'Összefoglaló',
        'app.pending_changes.col_attempts': 'Próbák',
        'app.pending_changes.col_error': 'Utolsó hiba',
        'app.pending_changes.col_status': 'Állapot',
        'app.pending_changes.col_actions': 'Műveletek',
        'app.pending_changes.operation.update': 'Módosítás',
        'app.pending_changes.operation.createAndConvert':
          'Mentés és ügylet kifejtése',
        'app.pending_changes.error_offline': 'Nincs kapcsolat',
        'app.pending_changes.status.pending': 'Várakozik',
        'ra.action.cancel': 'Mégse',
        'resources.transactions.name': 'Tranzakciók',
      };
      return map[key] ?? key;
    },
  };
});

vi.mock('ra-strapi', () => ({
  strapiHttpClient: () => vi.fn(),
}));

vi.mock('../../data/dataProvider', () => ({
  dataProviderInner: {
    update: vi.fn(),
  },
}));

vi.mock('../../data/pendingChanges/retryRunner', () => ({
  retrySinglePendingChange: vi.fn(async () => {}),
}));

describe('PendingChangesPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetPendingChangesPersistenceForTests();
    configureLocalStoragePersistenceForTests();
    await configureLocalStoragePersistenceForTests().reset();
    setTestPendingChangeUser({ userId: 5, username: 'page-user' });
  });

  afterEach(() => {
    cleanup();
    clearTestPendingChangeUser();
  });

  it('shows empty state', async () => {
    render(<PendingChangesPage />);
    expect(
      await screen.findByText('Nincs kiküldésre váró módosítás.'),
    ).toBeInTheDocument();
  });

  it('renders queued item actions', async () => {
    await enqueuePendingChange({
      resource: 'transactions',
      operation: 'update',
      payload: {
        kind: 'dataProvider',
        method: 'update',
        resource: 'transactions',
        params: { id: 'doc-1', data: { description: 'hello' } },
      },
      status: 'pending',
      lastError: '503',
      user: { userId: 5, username: 'page-user' },
    });
    render(<PendingChangesPage />);
    expect(await screen.findByText('Módosítás')).toBeInTheDocument();
    expect(screen.getAllByText('Újraküldés').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Összes újraküldése').length).toBeGreaterThan(0);
  });

  it('confirms discard', async () => {
    await enqueuePendingChange({
      resource: 'transactions',
      operation: 'update',
      payload: {
        kind: 'dataProvider',
        method: 'update',
        resource: 'transactions',
        params: { id: 'doc-2', data: {} },
      },
      status: 'pending',
      lastError: null,
      user: { userId: 5, username: 'page-user' },
    });
    render(<PendingChangesPage />);
    const user = userEvent.setup();
    const discardButtons = await screen.findAllByRole('button', {
      name: 'Elvetés',
    });
    await user.click(discardButtons[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Elvetés megerősítése'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Elvetés' }));
    expect(
      await screen.findByText('Nincs kiküldésre váró módosítás.'),
    ).toBeInTheDocument();
  });
});
