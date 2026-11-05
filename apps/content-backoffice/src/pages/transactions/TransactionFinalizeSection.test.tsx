import { cleanup, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../theme', () => ({
  bandedSpanClass: 'banded-span',
}));

import { TransactionFinalizeSection } from './TransactionFinalizeSection';

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    useTranslate: () => (key: string) => {
      const hu: Record<string, string> = {
        'app.transactions_review': 'Véglegesítés',
        'app.transactions_finalize_hint': 'Ellenőrizze az adatokat.',
        'app.transactions_finalize': 'Véglegesít',
        'app.transactions_finalize_same_person':
          'A rögzítő nem véglegesítheti a saját tranzakcióját.',
        'app.transactions_discard': 'Piszkozat törlése',
      };
      return hu[key] ?? key;
    },
    useNotify: () => vi.fn(),
    useRefresh: () => vi.fn(),
    useRedirect: () => vi.fn(),
  };
});

vi.mock('../../data/dataProvider', () => ({
  saveTransactionDraft: vi.fn(),
  publishTransaction: vi.fn(),
  discardTransaction: vi.fn(),
}));

function FormShell({ children }: { children: React.ReactNode }) {
  const methods = useForm();
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('TransactionFinalizeSection', () => {
  afterEach(() => cleanup());

  it('shows Piszkozat törlése even when same-person publish is blocked', () => {
    render(
      <FormShell>
        <TransactionFinalizeSection
          blocked={false}
          documentId="tx-doc-1"
          missingReceipt={false}
          samePersonBlocked
        />
      </FormShell>,
    );
    expect(
      screen.getByRole('button', { name: 'Piszkozat törlése' }),
    ).toBeEnabled();
  });

  it('disables Véglegesít when same-person publish is blocked', () => {
    render(
      <FormShell>
        <TransactionFinalizeSection
          blocked={false}
          documentId="tx-doc-1"
          missingReceipt={false}
          samePersonBlocked
        />
      </FormShell>,
    );
    expect(
      screen.getAllByRole('button', { name: 'Véglegesít' })[0],
    ).toBeDisabled();
    expect(
      screen.getByText('A rögzítő nem véglegesítheti a saját tranzakcióját.'),
    ).toBeVisible();
  });
});
