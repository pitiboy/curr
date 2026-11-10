import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../data/dataProvider', () => ({
  createNewTransactionDraft: vi.fn(),
  convertTransactionToWorkflow: vi.fn(),
}));

import { TransactionCreateToolbarGate } from './TransactionCreateToolbar';

const usePermissions = vi.fn();

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
  useTransactionWorkflowCatalog: () => ({
    workflows: [],
    loading: false,
    matchFor: () => null,
    isEditor: true,
  }),
}));

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
    useWatch: () => ({
      date: '2026-01-01',
      amount: 10,
      currency_type: 'cur-1',
      description: 'ok',
    }),
  };
});

describe('TransactionCreateToolbarGate', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows only save for dataentry (no convert CTA)', () => {
    usePermissions.mockReturnValue({
      permissions: 'dataentry',
      isPending: false,
    });
    render(
      <TransactionCreateToolbarGate
        accounts={[]}
        receiptCards={[]}
        onSaveSucceeded={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Mentés' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /app\.transactions_convert_save/i }),
    ).toBeNull();
  });

  it('renders the editor-like toolbar for controller', () => {
    usePermissions.mockReturnValue({
      permissions: 'controller',
      isPending: false,
    });
    render(
      <TransactionCreateToolbarGate
        accounts={[]}
        receiptCards={[]}
        onSaveSucceeded={() => undefined}
      />,
    );
    // Editor-like path mounts TransactionCreateToolbar (SaveButton still present).
    expect(screen.getByRole('button', { name: 'Mentés' })).toBeVisible();
  });
});
