import { Box, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormState } from 'react-hook-form';
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
  useTranslate,
  type RaRecord,
} from 'react-admin';

import {
  accountChoiceLabel,
  filterAccountChoices,
  loadAllAccounts,
  type AccountChoice,
} from '../../data/accountCodes';
import { receiptCardInvalid } from '../../data/receiptDraft';
import { bandedForm } from '../../theme';
import { ReceiptRail, type ReceiptCardValue } from './ReceiptFields';
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

function DraftSaveToolbar() {
  return (
    <Toolbar>
      <SaveButton />
    </Toolbar>
  );
}

function CreateLeaveGuard({ receiptCardCount }: { receiptCardCount: number }) {
  const formDirty = useFormIsDirty();
  const { isSubmitSuccessful } = useFormState();
  const dirtyRef = useRef(false);
  const submittedRef = useRef(false);
  dirtyRef.current = formDirty || receiptCardCount > 0;
  submittedRef.current = isSubmitSuccessful;
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
  return (
    <CreateLeaveBlocker dirtyRef={dirtyRef} submittedRef={submittedRef} />
  );
}

function CreateLeaveBlocker({
  dirtyRef,
  submittedRef,
}: {
  dirtyRef: { current: boolean };
  submittedRef: { current: boolean };
}) {
  const shouldBlock = useCallback(
    ({
      currentLocation,
      nextLocation,
    }: {
      currentLocation: { pathname: string };
      nextLocation: { pathname: string };
    }) =>
      shouldConfirmDirtyCreateLeave({
        dirty: dirtyRef.current,
        submitted: submittedRef.current,
        currentPathname: currentLocation.pathname,
        nextPathname: nextLocation.pathname,
      }),
    [dirtyRef, submittedRef],
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (dirtyRef.current && !submittedRef.current) return;
    blocker.proceed?.();
  }, [blocker, dirtyRef, submittedRef]);

  return (
    <Confirm
      cancel="app.transactions_leave_stay"
      confirm="app.transactions_leave_go"
      confirmColor="warning"
      content="app.transactions_leave_unsaved_body"
      isOpen={blocker.state === 'blocked'}
      title="app.transactions_leave_unsaved_title"
      onClose={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
    />
  );
}

function useAccountCatalog() {
  const dataProvider = useDataProvider();
  const [accounts, setAccounts] = useState<AccountChoice[]>([]);
  const [isPending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAllAccounts((resource, params) => dataProvider.getList(resource, params))
      .then((rows) => {
        if (!cancelled) setAccounts(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataProvider]);

  return { accounts, isPending, failed };
}

function AccountCodeInput({
  accounts,
  failed,
  isPending,
  kind,
  source,
}: {
  accounts: AccountChoice[];
  failed: boolean;
  isPending: boolean;
  kind: 'debit' | 'credit';
  source: string;
}) {
  const translate = useTranslate();
  const choices = filterAccountChoices(accounts, kind).map((account) => ({
    id: account.id,
    name: accountChoiceLabel(account),
  }));

  return (
    <Box>
      <AutocompleteInput
        choices={choices}
        fullWidth
        isLoading={isPending}
        source={source}
        translateChoice={false}
        validate={required()}
      />
      {!isPending && !failed && choices.length === 0 ? (
        <Typography color="warning.main" variant="body2">
          {translate('app.accounts_seed_missing')}
        </Typography>
      ) : null}
    </Box>
  );
}

/** Dataentry create. Save always goes out as a draft; there is no publish action. */
export function TransactionCreate() {
  const catalog = useAccountCatalog();
  const translate = useTranslate();
  const [receiptCards, setReceiptCards] = useState<ReceiptCardValue[]>([]);

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
        toolbar={<DraftSaveToolbar />}
        validate={(values: { description?: unknown }) => {
          const description =
            typeof values.description === 'string' ? values.description.trim() : '';
          const hasFile = receiptCards.some(
            (card) => card.file && card.file.size > 0,
          );
          const errors: Record<string, string> = {};
          if (hasFile && !description) {
            errors.description = translate('app.receipt_description_required');
          }
          if (receiptCards.some(receiptCardInvalid)) {
            errors.receipt_cards = translate('app.receipt_card_required');
          }
          return errors;
        }}
      >
        <CreateLeaveGuard receiptCardCount={receiptCards.length} />
        <DateInput fullWidth source="date" validate={required()} />
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
        <TextInput fullWidth multiline source="description" />
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
            validate={required()}
          />
        </ReferenceInput>
        <AccountCodeInput
          accounts={catalog.accounts}
          failed={catalog.failed}
          isPending={catalog.isPending}
          kind="debit"
          source="debit_account"
        />
        <AccountCodeInput
          accounts={catalog.accounts}
          failed={catalog.failed}
          isPending={catalog.isPending}
          kind="credit"
          source="credit_account"
        />
        <ReceiptRail cards={receiptCards} onChange={setReceiptCards} />
      </SimpleForm>
    </Create>
  );
}
