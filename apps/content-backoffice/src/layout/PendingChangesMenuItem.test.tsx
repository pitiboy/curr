import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearTestPendingChangeUser,
  setTestPendingChangeUser,
} from '../data/pendingChanges/currentUser';
import { useLocalStoragePersistenceForTests } from '../data/pendingChanges/persistence';
import { enqueuePendingChange } from '../data/pendingChanges/store';

import { PendingChangesMenuItem } from './PendingChangesMenuItem';

vi.mock('react-admin', async () => {
  const actual =
    await vi.importActual<typeof import('react-admin')>('react-admin');
  return {
    ...actual,
    Menu: {
      Item: ({
        leftIcon,
        primaryText,
        to,
      }: {
        leftIcon?: React.ReactNode;
        primaryText: string;
        to: string;
      }) => (
        <a href={to}>
          {leftIcon}
          {primaryText}
        </a>
      ),
    },
    useTranslate: () => (key: string) =>
      key === 'app.pending_changes.menu' ? 'Kiküldésre váró módosítások' : key,
  };
});

describe('PendingChangesMenuItem badge', () => {
  beforeEach(async () => {
    useLocalStoragePersistenceForTests();
    await useLocalStoragePersistenceForTests().reset();
    setTestPendingChangeUser({ userId: 11, username: 'menu' });
  });

  afterEach(() => {
    clearTestPendingChangeUser();
  });

  it('shows menu label', async () => {
    render(<PendingChangesMenuItem />);
    expect(
      await screen.findByText('Kiküldésre váró módosítások'),
    ).toBeInTheDocument();
  });

  it('shows badge count when pending items exist', async () => {
    await enqueuePendingChange({
      resource: 'transactions',
      operation: 'create',
      payload: {
        kind: 'dataProvider',
        method: 'create',
        resource: 'transactions',
        params: { data: {} },
      },
      status: 'pending',
      lastError: null,
      user: { userId: 11, username: 'menu' },
    });
    render(<PendingChangesMenuItem />);
    await waitFor(() => {
      expect(document.querySelector('.MuiBadge-badge')).toHaveTextContent('1');
    });
  });
});
