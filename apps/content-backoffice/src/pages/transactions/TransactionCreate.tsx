import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormState } from 'react-hook-form';
import type { Middleware } from 'ra-core';
import {
  AutocompleteInput,
  Confirm,
  Create,
  DateInput,
  NumberInput,
  ReferenceInput,
  required,
  SimpleForm,
  TextInput,
  useBlocker,
  useCanBlock,
  useFormIsDirty,
  useRegisterMutationMiddleware,
  useTranslate,
  type RaRecord,
} from 'react-admin';

import { bandedForm, bandedSpanClass } from '../../theme';
import { TransactionAccountProfileRow } from './TransactionAccountProfileRow';
import { useAccountCatalog } from './useAccountCatalog';
import { ReceiptRail, type ReceiptCardValue } from './ReceiptFields';
import { transactionFormErrors } from './transactionForm';
import { shouldConfirmDirtyCreateLeave } from './transactionLeave';
import { TransactionCreateToolbarGate } from './TransactionCreateToolbar';

function currencyOptionText(record: RaRecord): string {
  const currency = record as { code?: string | null; name?: string | null };
  return [currency.code, currency.name].filter(Boolean).join(' ');
}

function nameFilterToQuery(searchText: string) {
  const query = searchText.trim();
  return query ? { name: { $containsi: query } } : {};
}

function codeOrNameFilterToQuery(searchText: string) {
  const query = searchText.trim();
  if (!query) return {};
  return {
    $or: [{ name: { $containsi: query } }, { code: { $containsi: query } }],
  };
}

function CreateSaveSucceededMarker({
  onSaveSucceeded,
}: {
  onSaveSucceeded: () => void;
}) {
  const middleware = useCallback<Middleware>(
    async (resource, params, next) => {
      const result = await next(resource, params);
      onSaveSucceeded();
      return result;
    },
    [onSaveSucceeded],
  );
  useRegisterMutationMiddleware(middleware);
  return null;
}

function CreateLeaveGuard({
  receiptCardCount,
  saveSucceeded,
  saveSucceededRef,
}: {
  receiptCardCount: number;
  saveSucceeded: boolean;
  saveSucceededRef: { current: boolean };
}) {
  const formDirty = useFormIsDirty();
  const { isSubmitSuccessful } = useFormState();
  const dirtyRef = useRef(false);
  dirtyRef.current = formDirty || receiptCardCount > 0;
  // Shared ref: SaveButton middleware and "save and expand" both flip this
  // synchronously so redirect does not race a pending setState.
  if (isSubmitSuccessful || saveSucceeded) {
    saveSucceededRef.current = true;
  }
  const unsaved = dirtyRef.current && !saveSucceededRef.current;

  useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsaved]);

  const canBlock = useCanBlock();
  if (!canBlock) return null;

  return (
    <CreateLeaveBlocker
      dirty={dirtyRef.current}
      dirtyRef={dirtyRef}
      submitted={saveSucceededRef.current}
      submittedRef={saveSucceededRef}
    />
  );
}

function CreateLeaveBlocker({
  dirty,
  dirtyRef,
  submitted,
  submittedRef,
}: {
  dirty: boolean;
  dirtyRef: { current: boolean };
  submitted: boolean;
  submittedRef: { current: boolean };
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingNavigationRef = useRef<{
    currentPathname: string;
    nextPathname: string;
  } | null>(null);

  const shouldBlock = useCallback(
    ({
      currentLocation,
      nextLocation,
    }: {
      currentLocation: { pathname: string };
      nextLocation: { pathname: string };
    }) => {
      pendingNavigationRef.current = {
        currentPathname: currentLocation.pathname,
        nextPathname: nextLocation.pathname,
      };
      return shouldConfirmDirtyCreateLeave({
        dirty: dirtyRef.current,
        submitted: submittedRef.current,
        currentPathname: currentLocation.pathname,
        nextPathname: nextLocation.pathname,
      });
    },
    [dirtyRef, submittedRef],
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      setConfirmOpen(false);
      return;
    }
    const pending = pendingNavigationRef.current;
    const shouldConfirm =
      pending != null &&
      shouldConfirmDirtyCreateLeave({
        dirty: dirtyRef.current,
        submitted: submittedRef.current,
        currentPathname: pending.currentPathname,
        nextPathname: pending.nextPathname,
      });
    if (!shouldConfirm) {
      setConfirmOpen(false);
      blocker.proceed?.();
      return;
    }
    setConfirmOpen(true);
  }, [blocker.state, dirty, submitted, dirtyRef, submittedRef, blocker]);

  return (
    <Confirm
      cancel="app.transactions_leave_stay"
      confirm="app.transactions_leave_go"
      confirmColor="warning"
      content="app.transactions_leave_unsaved_body"
      isOpen={confirmOpen}
      title="app.transactions_leave_unsaved_title"
      onClose={() => {
        setConfirmOpen(false);
        blocker.reset?.();
      }}
      onConfirm={() => {
        setConfirmOpen(false);
        blocker.proceed?.();
      }}
    />
  );
}

/** Dataentry create. Save always goes out as a draft; there is no publish action. */
export function TransactionCreate() {
  const catalog = useAccountCatalog();
  const translate = useTranslate();
  const [receiptCards, setReceiptCards] = useState<ReceiptCardValue[]>([]);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const saveSucceededRef = useRef(false);
  const onSaveSucceeded = useCallback(() => {
    saveSucceededRef.current = true;
    setSaveSucceeded(true);
  }, []);

  return (
    <Create
      redirect="list"
      resource="transactions"
      title="app.transactions_create"
      transform={(data) => ({
        ...data,
        receipt_cards: receiptCards,
      })}
    >
      <SimpleForm
        sx={bandedForm}
        toolbar={
          <TransactionCreateToolbarGate
            accounts={catalog.accounts}
            onSaveSucceeded={onSaveSucceeded}
            receiptCards={receiptCards}
          />
        }
        validate={(values) =>
          transactionFormErrors(
            values as Record<string, unknown>,
            receiptCards,
            translate,
          )
        }
      >
        <CreateSaveSucceededMarker onSaveSucceeded={onSaveSucceeded} />
        <CreateLeaveGuard
          receiptCardCount={receiptCards.length}
          saveSucceeded={saveSucceeded}
          saveSucceededRef={saveSucceededRef}
        />

        <DateInput fullWidth source="date" validate={required()} />
        <ReferenceInput
          perPage={100}
          reference="organizations"
          sort={{ field: 'name', order: 'ASC' }}
          source="organization"
        >
          <AutocompleteInput
            filterToQuery={nameFilterToQuery}
            fullWidth
            optionText="name"
          />
        </ReferenceInput>

        <NumberInput fullWidth source="amount" validate={required()} />
        <ReferenceInput
          perPage={100}
          reference="currency-types"
          sort={{ field: 'code', order: 'ASC' }}
          source="currency_type"
        >
          <AutocompleteInput
            filterToQuery={codeOrNameFilterToQuery}
            fullWidth
            optionText={currencyOptionText}
            validate={required()}
          />
        </ReferenceInput>

        <TextInput
          className={bandedSpanClass}
          fullWidth
          multiline
          source="description"
          validate={required()}
        />

        <TransactionAccountProfileRow
          accounts={catalog.accounts}
          defaultProfile="cost"
          failed={catalog.failed}
          isPending={catalog.isPending}
        />

        <ReceiptRail cards={receiptCards} onChange={setReceiptCards} />
      </SimpleForm>
    </Create>
  );
}
