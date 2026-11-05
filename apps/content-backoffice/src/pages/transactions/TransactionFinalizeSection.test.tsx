import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    useTranslate:
      () => (key: string, options?: { errors?: number; warnings?: number }) => {
        const hu: Record<string, string> = {
          'app.transactions_review': 'Véglegesítés',
          'app.transactions_finalize_hint': 'Ellenőrizze az adatokat.',
          'app.transactions_finalize': 'Véglegesít',
          'app.transactions_finalize_same_person':
            'A rögzítő nem véglegesítheti a saját tranzakcióját.',
          'app.transactions_finalize_no_receipt':
            'Ehhez a tranzakcióhoz nincs csatolt bizonylat.',
          'app.transactions_finalize_pending':
            'A csatolt fájl még nincs mentve.',
          'app.transactions_finalize_issues': `${options?.errors ?? 0} hiba, ${options?.warnings ?? 0} figyelmeztetés`,
          'app.transactions_discard': 'Piszkozat törlése',
          'resources.transactions.fields.date': 'Dátum',
          'resources.transactions.fields.amount': 'Összeg',
          'resources.transactions.fields.currency_type': 'Pénznem',
          'resources.transactions.fields.description': 'Leírás',
          'resources.transactions.fields.organization': 'Szervezet',
          'resources.transactions.fields.debit_account': 'Költség számla',
          'resources.transactions.fields.credit_account': 'Kifizető számla',
          'ra.validation.required': 'Kötelező',
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

function FormShell({
  children,
  values,
}: {
  children: React.ReactNode;
  values?: Record<string, unknown>;
}) {
  const methods = useForm({
    defaultValues: values ?? {
      date: '2026-11-05',
      amount: -232323,
      currency_type: 'cur-1',
      description: 'asdfsdfsdf',
      organization: 'org-1',
      debit_account: 'deb-1',
      credit_account: 'cre-1',
    },
  });
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
  });

  it('puts finalize blockers in a warning accordion above the buttons', async () => {
    const user = userEvent.setup();
    render(
      <FormShell>
        <TransactionFinalizeSection
          blocked={false}
          documentId="tx-doc-1"
          missingReceipt
          samePersonBlocked
        />
      </FormShell>,
    );

    const toggle = screen.getByRole('button', {
      name: /1 hiba, 1 figyelmeztetés/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByText('A rögzítő nem véglegesítheti a saját tranzakcióját.'),
    ).not.toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText('A rögzítő nem véglegesítheti a saját tranzakcióját.'),
    ).toBeVisible();
    expect(
      screen.getByText('Ehhez a tranzakcióhoz nincs csatolt bizonylat.'),
    ).toBeVisible();
  });

  it('counts missing receipt as warning only', () => {
    render(
      <FormShell>
        <TransactionFinalizeSection
          blocked={false}
          documentId="tx-doc-1"
          missingReceipt
          samePersonBlocked={false}
        />
      </FormShell>,
    );

    expect(
      screen.getByRole('button', { name: /0 hiba, 1 figyelmeztetés/ }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('button', { name: 'Véglegesít' })[0],
    ).toBeEnabled();
  });
});
