import { render, screen } from '@testing-library/react';
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
      };
      return hu[key] ?? key;
    },
    useNotify: () => vi.fn(),
    useRefresh: () => vi.fn(),
  };
});

vi.mock('../../data/dataProvider', () => ({
  saveTransactionDraft: vi.fn(),
  publishTransaction: vi.fn(),
}));

function FormShell({ children }: { children: React.ReactNode }) {
  const methods = useForm();
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('TransactionFinalizeSection', () => {
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
    expect(screen.getByRole('button', { name: 'Véglegesít' })).toBeDisabled();
    expect(
      screen.getByText('A rögzítő nem véglegesítheti a saját tranzakcióját.'),
    ).toBeVisible();
  });
});
