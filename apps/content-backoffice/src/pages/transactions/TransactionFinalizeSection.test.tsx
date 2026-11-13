import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../theme', () => ({
  bandedSpanClass: 'banded-span',
}));

vi.mock('./TransactionConvertSection', () => ({
  TransactionConvertSection: () => null,
}));

import { discardTransaction } from '../../data/dataProvider';
import { TransactionFinalizeSection } from './TransactionFinalizeSection';

const redirect = vi.fn();

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
          'app.form_issues_count': `${options?.errors ?? 0} hiba, ${options?.warnings ?? 0} figyelmeztetés`,
          'app.transactions_discard': 'Piszkozat törlése',
          'app.transactions_discard_title': 'Piszkozat törlése',
          'app.transactions_discard_body':
            'A tranzakció és a hozzá csatolt piszkozat bizonylatok véglegesen törlődnek.',
          'app.transactions_discard_confirm': 'Törlés',
          'app.transactions_discard_done': 'A piszkozat tranzakció törölve.',
          'ra.action.cancel': 'Mégsem',
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
    useRedirect: () => redirect,
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

function renderFinalize(
  props: Partial<{
    allowLeaveRef: { current: boolean };
    blocked: boolean;
    missingReceipt: boolean;
    samePersonBlocked: boolean;
  }> = {},
) {
  const allowLeaveRef = props.allowLeaveRef ?? { current: false };
  return {
    allowLeaveRef,
    ...render(
      <FormShell>
        <TransactionFinalizeSection
          allowLeaveRef={allowLeaveRef}
          blocked={props.blocked ?? false}
          documentId="tx-doc-1"
          missingReceipt={props.missingReceipt ?? false}
          samePersonBlocked={props.samePersonBlocked ?? false}
        />
      </FormShell>,
    ),
  };
}

describe('TransactionFinalizeSection', () => {
  afterEach(() => {
    cleanup();
    redirect.mockReset();
    vi.mocked(discardTransaction).mockReset();
  });

  it('shows Piszkozat törlése even when same-person publish is blocked', () => {
    renderFinalize({ samePersonBlocked: true });
    expect(
      screen.getByRole('button', { name: 'Piszkozat törlése' }),
    ).toBeEnabled();
  });

  it('disables Véglegesít when same-person publish is blocked', () => {
    renderFinalize({ samePersonBlocked: true });
    expect(
      screen.getAllByRole('button', { name: 'Véglegesít' })[0],
    ).toBeDisabled();
  });

  it('wires the shared issue accordion above the buttons', () => {
    renderFinalize({ missingReceipt: true, samePersonBlocked: true });
    expect(
      screen.getByRole('button', {
        name: /Véglegesítés.*1 hiba, 1 figyelmeztetés/,
      }),
    ).toBeVisible();
  });

  it('releases the leave guard before redirecting after discard', async () => {
    const user = userEvent.setup();
    vi.mocked(discardTransaction).mockResolvedValue(undefined);
    const { allowLeaveRef } = renderFinalize();

    await user.click(screen.getByRole('button', { name: 'Piszkozat törlése' }));
    await user.click(
      screen.getByRole('button', { name: 'app.transactions_discard_confirm' }),
    );

    await waitFor(() => {
      expect(allowLeaveRef.current).toBe(true);
      expect(redirect).toHaveBeenCalledWith('list', 'transactions');
    });
  });
});
