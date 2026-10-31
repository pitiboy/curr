import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Typography } from '@mui/material';
import { useFormContext, useFormState, useWatch } from 'react-hook-form';
import type { Middleware } from 'ra-core';
import {
  AutocompleteInput,
  Confirm,
  Create,
  DateInput,
  NumberInput,
  ReferenceInput,
  required,
  SaveButton,
  SimpleForm,
  TextInput,
  Toolbar,
  useBlocker,
  useCanBlock,
  useDataProvider,
  useFormIsDirty,
  useNotify,
  useRedirect,
  useRegisterMutationMiddleware,
  useTranslate,
  type RaRecord,
} from 'react-admin';

import type { AccountChoice } from '../../data/accountCodes';
import { convertTransactionToWorkflow } from '../../data/dataProvider';
import { strapiErrorMessage } from '../../data/transactionPublish';
import { workflowSubjectFromForm } from '../../data/transactionWorkflow';
import { bandedForm, bandedSpanClass } from '../../theme';
import { TransactionAccountProfileRow } from './TransactionAccountProfileRow';
import { useAccountCatalog } from './useAccountCatalog';
import { useTransactionWorkflowCatalog } from './useTransactionWorkflowCatalog';
import { ReceiptRail, type ReceiptCardValue } from './ReceiptFields';
import { transactionFormErrors } from './transactionForm';
import { shouldConfirmDirtyCreateLeave } from './transactionLeave';

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

type DraftData = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Editor only: save the draft, then Convert it with the matching template.
 * The match runs on the form values. The account selects hold documentIds,
 * so the codes come from the already loaded account catalog.
 */
function SaveAndConvertButton({
  accounts,
  onSaved,
  toDraftData,
}: {
  accounts: AccountChoice[];
  onSaved: () => void;
  toDraftData: DraftData;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const redirect = useRedirect();
  const dataProvider = useDataProvider();
  const { trigger, getValues } = useFormContext();
  const { isEditor, matchFor, isAmbiguous } = useTransactionWorkflowCatalog();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const debit = useWatch({ name: 'debit_account' });
  const credit = useWatch({ name: 'credit_account' });
  const currency = useWatch({ name: 'currency_type' });
  const subject = workflowSubjectFromForm(
    { debit_account: debit, credit_account: credit, currency_type: currency },
    accounts,
  );
  const workflow = isEditor ? matchFor(subject) : null;

  // Leave only after the unsaved-changes guard has seen the saved state.
  useEffect(() => {
    if (leaving) redirect('list', 'transactions');
  }, [leaving, redirect]);

  if (!isEditor) return null;
  if (!workflow) {
    return isAmbiguous(subject) ? (
      <Typography sx={{ ml: 1 }} variant="body2">
        {translate('app.transactions_convert_ambiguous')}
      </Typography>
    ) : null;
  }

  const onClick = () => {
    void trigger().then((valid) => {
      if (valid) setOpen(true);
      else notify('ra.message.invalid_form', { type: 'warning' });
    });
  };

  const onConfirm = async () => {
    if (busy) return;
    setBusy(true);
    let documentId = '';
    try {
      // Same draft create as SaveButton: transform + receipt_cards, status=draft.
      const created = await dataProvider.create('transactions', {
        data: toDraftData(getValues() as Record<string, unknown>),
      });
      documentId = String(created.data.documentId ?? created.data.id ?? '');
    } catch (error) {
      notify(strapiErrorMessage(error) || 'ra.notification.http_error', {
        type: 'error',
      });
      setOpen(false);
      setBusy(false);
      return;
    }
    onSaved();
    try {
      await convertTransactionToWorkflow({
        transactionDocumentId: documentId,
        workflowDocumentId: workflow.documentId,
      });
      notify('app.transactions_convert_done', { type: 'success' });
    } catch (error) {
      // The draft exists now; say so and go to the list instead of re-saving.
      notify(
        strapiErrorMessage(error) ||
          'app.transactions_convert_saved_not_converted',
        { type: 'error' },
      );
    }
    setOpen(false);
    setBusy(false);
    setLeaving(true);
  };

  return (
    <>
      <Button
        disabled={busy}
        sx={{ ml: 1 }}
        type="button"
        variant="outlined"
        onClick={onClick}
      >
        {translate('app.transactions_convert_save')}
      </Button>
      <Confirm
        confirm="app.transactions_convert_confirm"
        content="app.transactions_convert_body"
        isOpen={open}
        loading={busy}
        title="app.transactions_convert_title"
        titleTranslateOptions={{ name: workflow.name ?? '' }}
        onClose={() => setOpen(false)}
        onConfirm={() => void onConfirm()}
      />
    </>
  );
}

function DraftSaveToolbar({
  accounts,
  onSaved,
  toDraftData,
}: {
  accounts: AccountChoice[];
  onSaved: () => void;
  toDraftData: DraftData;
}) {
  return (
    <Toolbar>
      <SaveButton />
      <SaveAndConvertButton
        accounts={accounts}
        onSaved={onSaved}
        toDraftData={toDraftData}
      />
    </Toolbar>
  );
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
}: {
  receiptCardCount: number;
  saveSucceeded: boolean;
}) {
  const formDirty = useFormIsDirty();
  const { isSubmitSuccessful } = useFormState();
  const dirtyRef = useRef(false);
  const submittedRef = useRef(false);
  dirtyRef.current = formDirty || receiptCardCount > 0;
  submittedRef.current = isSubmitSuccessful || saveSucceeded;
  const unsaved = dirtyRef.current && !submittedRef.current;

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
  const submitted = isSubmitSuccessful || saveSucceeded;

  return (
    <CreateLeaveBlocker
      dirty={dirtyRef.current}
      dirtyRef={dirtyRef}
      submitted={submitted}
      submittedRef={submittedRef}
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
  const onSaveSucceeded = useCallback(() => setSaveSucceeded(true), []);
  const toDraftData = useCallback<DraftData>(
    (data) => ({ ...data, receipt_cards: receiptCards }),
    [receiptCards],
  );

  return (
    <Create
      redirect="list"
      resource="transactions"
      title="app.transactions_create"
      transform={toDraftData}
    >
      <SimpleForm
        sx={bandedForm}
        toolbar={
          <DraftSaveToolbar
            accounts={catalog.accounts}
            toDraftData={toDraftData}
            onSaved={onSaveSucceeded}
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
