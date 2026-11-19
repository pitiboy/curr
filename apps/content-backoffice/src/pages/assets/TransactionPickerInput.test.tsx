import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import {
  FormProvider,
  useController,
  useForm,
  useFormContext,
} from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AcquisitionFieldPrefill } from './assetPrefill';
import type { TransactionPickerOption } from './transactionPicker';
import type { TransactionUsage } from './transactionUsage';

// ra-strapi's CJS build fails under Vitest ESM — the client is never used here.
vi.mock('ra-strapi', () => ({ strapiHttpClient: () => vi.fn() }));

const searchTransactionsForPicker = vi.fn();
vi.mock('./transactionPicker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./transactionPicker')>();
  return {
    ...actual,
    searchTransactionsForPicker: (...args: unknown[]) =>
      searchTransactionsForPicker(...args),
  };
});

const loadTransactionUsage = vi.fn();
vi.mock('./transactionUsage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./transactionUsage')>();
  return {
    ...actual,
    loadTransactionUsage: (...args: unknown[]) => loadTransactionUsage(...args),
  };
});

const loadAcquisitionPrefill = vi.fn();
vi.mock('./assetPrefill', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./assetPrefill')>();
  return {
    ...actual,
    loadAcquisitionPrefill: (...args: unknown[]) =>
      loadAcquisitionPrefill(...args),
  };
});

let record: Record<string, unknown> | undefined;
vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-admin')>();
  return {
    ...actual,
    useTranslate: () => (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    useRecordContext: () => record,
    useGetOne: () => ({ data: undefined }),
    // Plain react-hook-form binding (no React Admin form context needed).
    useInput: ({ source }: { source: string }) => {
      const { field, fieldState } = useController({ name: source });
      return { field, fieldState };
    },
  };
});

const { TransactionPickerInput } = await import('./TransactionPickerInput');

const OPTIONS: TransactionPickerOption[] = [
  {
    id: 'tx-shovel',
    label: '2026-11-19 · 7878 HUF · Lapát',
    amount: 7878,
    currencyCode: 'HUF',
    usage: { assetCount: 1, linkedTotal: 5000 },
  },
  {
    id: 'tx-barrow',
    label: '2026-11-20 · 20000 HUF · Talicska',
    amount: 20000,
    currencyCode: 'HUF',
  },
];

const SHOVEL_PREFILL: AcquisitionFieldPrefill = {
  name: 'Lapát',
  purchase_price: 2878,
  currency_type: 'huf',
  purchase_date: '2026-11-19',
  organization: 'org-1',
  responsible_member: 'member-1',
};

let formApi: ReturnType<typeof useFormContext> | null = null;

function FormSpy() {
  const methods = useFormContext();
  useEffect(() => {
    formApi = methods;
  }, [methods]);
  return null;
}

function Form({
  children,
  defaults = {},
}: {
  children: ReactNode;
  defaults?: Record<string, unknown>;
}) {
  const methods = useForm({ defaultValues: defaults });
  return (
    <FormProvider {...methods}>
      {children}
      <FormSpy />
    </FormProvider>
  );
}

function renderPicker(
  props: Partial<Parameters<typeof TransactionPickerInput>[0]> = {},
  defaults: Record<string, unknown> = {},
) {
  return render(
    <Form defaults={defaults}>
      <TransactionPickerInput
        side="debit"
        source="acquisition_transaction"
        {...props}
      />
    </Form>,
  );
}

async function openAndPick(label: RegExp) {
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByText(label));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  record = undefined;
  formApi = null;
  searchTransactionsForPicker.mockResolvedValue(OPTIONS);
  loadTransactionUsage.mockResolvedValue(new Map<string, TransactionUsage>());
  loadAcquisitionPrefill.mockResolvedValue(SHOVEL_PREFILL);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TransactionPickerInput – options', () => {
  it('shows how much of a transaction is already linked', async () => {
    renderPicker();
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(
      await screen.findByText(/app\.assets\.transaction_picker_usage/),
    ).toHaveTextContent('"count":1');
    // Only the shovel carries a usage line.
    expect(
      screen.getAllByText(/app\.assets\.transaction_picker_usage/),
    ).toHaveLength(1);
  });

  it('passes the edited asset id so it is left out of the counts', async () => {
    record = { documentId: 'asset-7', refs: {} };
    renderPicker();
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await waitFor(() =>
      expect(searchTransactionsForPicker).toHaveBeenCalledWith(
        expect.anything(),
        '',
        'debit',
        'asset-7',
      ),
    );
  });
});

describe('TransactionPickerInput – prefill on pick', () => {
  it('fills the asset fields from the picked acquisition', async () => {
    renderPicker({ prefillOnPick: true });
    await openAndPick(/Lapát/);
    await waitFor(() =>
      expect(formApi?.getValues()).toMatchObject({
        acquisition_transaction: 'tx-shovel',
        ...SHOVEL_PREFILL,
      }),
    );
    expect(loadAcquisitionPrefill).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'tx-shovel',
      null,
    );
  });

  it('keeps what the user typed', async () => {
    renderPicker(
      { prefillOnPick: true },
      { name: 'Piros lapát', purchase_price: 3000 },
    );
    await openAndPick(/Lapát/);
    await waitFor(() =>
      expect(formApi?.getValues('organization')).toBe('org-1'),
    );
    expect(formApi?.getValues()).toMatchObject({
      name: 'Piros lapát',
      purchase_price: 3000,
    });
  });

  it('follows a new pick on fields the previous pick filled', async () => {
    renderPicker({ prefillOnPick: true });
    await openAndPick(/Lapát/);
    await waitFor(() =>
      expect(formApi?.getValues('purchase_price')).toBe(2878),
    );
    act(() => formApi?.setValue('name', 'Kézzel átírt'));

    loadAcquisitionPrefill.mockResolvedValueOnce({
      ...SHOVEL_PREFILL,
      name: 'Talicska',
      purchase_price: 20000,
      purchase_date: '2026-11-20',
    });
    await openAndPick(/Talicska/);
    await waitFor(() =>
      expect(formApi?.getValues('purchase_price')).toBe(20000),
    );
    expect(formApi?.getValues()).toMatchObject({
      name: 'Kézzel átírt',
      purchase_date: '2026-11-20',
    });
  });

  it('applies only the latest pick when responses arrive out of order', async () => {
    const slow = deferred<AcquisitionFieldPrefill>();
    loadAcquisitionPrefill
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce({ purchase_price: 20000 });
    renderPicker({ prefillOnPick: true });
    await openAndPick(/Lapát/);
    await openAndPick(/Talicska/);
    await waitFor(() =>
      expect(formApi?.getValues('purchase_price')).toBe(20000),
    );
    await act(async () => {
      slow.resolve(SHOVEL_PREFILL);
      await slow.promise;
    });
    expect(formApi?.getValues('purchase_price')).toBe(20000);
    expect(formApi?.getValues('name')).toBeUndefined();
  });

  it('does not prefill from the disposal picker', async () => {
    renderPicker({ side: 'credit', source: 'disposal_transaction' });
    await openAndPick(/Lapát/);
    await waitFor(() =>
      expect(formApi?.getValues('disposal_transaction')).toBe('tx-shovel'),
    );
    expect(loadAcquisitionPrefill).not.toHaveBeenCalled();
  });
});

describe('TransactionPickerInput – over-link warning', () => {
  it('warns while the price overshoots the transaction, clears when fixed', async () => {
    loadTransactionUsage.mockResolvedValue(
      new Map([['tx-shovel', { assetCount: 1, linkedTotal: 5000 }]]),
    );
    renderPicker({}, { purchase_price: 7878 });
    await openAndPick(/Lapát/);
    expect(
      await screen.findByText(/transaction_picker_over_linked/),
    ).toHaveTextContent('"total":"12');

    act(() => formApi?.setValue('purchase_price', 2878));
    await waitFor(() =>
      expect(
        screen.queryByText(/transaction_picker_over_linked/),
      ).not.toBeInTheDocument(),
    );
    // Within the amount: the usage note stays as helper text.
    expect(
      screen.getByText(/app\.assets\.transaction_picker_usage/),
    ).toBeInTheDocument();
  });
});
