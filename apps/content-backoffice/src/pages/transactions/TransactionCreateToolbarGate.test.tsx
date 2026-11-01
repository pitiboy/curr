import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
    SaveButton: () => (
      <button type="button">
        Mentés
      </button>
    ),
  };
});

vi.mock('../../workflows/useTransactionWorkflowCatalog', () => ({
  useTransactionWorkflowCatalog: () => ({
    matchFor: () => null,
  }),
}));

vi.mock('react-hook-form', () => ({
  useWatch: () => undefined,
}));

describe('TransactionCreateToolbarGate', () => {
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
});
