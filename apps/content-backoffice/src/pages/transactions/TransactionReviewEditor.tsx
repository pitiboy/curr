import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Button, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  AutocompleteInput,
  Confirm,
  DateField,
  DateInput,
  FunctionField,
  NumberInput,
  ReferenceInput,
  required,
  SelectField,
  SimpleForm,
  SimpleShowLayout,
  TextField,
  TextInput,
  useBlocker,
  useCanBlock,
  useDataProvider,
  useNotify,
  useRefresh,
  useTranslate,
  type RaRecord,
} from 'react-admin';

import {
  accountChoiceLabel,
  filterAccountChoices,
  loadAllAccounts,
  type AccountChoice,
} from '../../data/accountCodes';
import {
  attachTransactionReceipt,
  publishTransaction,
  saveTransactionDraft,
} from '../../data/dataProvider';
import { receiptCardInvalid, receiptCount } from '../../data/receiptDraft';
import {
  isSamePersonPublishError,
  strapiErrorMessage,
} from '../../data/transactionPublish';
import {
  firstReceiptVendor,
  type TransactionRow,
} from '../../data/transactionList';
import { bandedForm, bandedShow, bandedSpanClass } from '../../theme';
import { AccountFieldLabel } from './accountField';
import { dateFieldProps } from './dateField';
import { ReceiptRail, type ReceiptCardValue } from './ReceiptFields';
import { shouldConfirmDraftLeave } from './transactionLeave';
import {
  reviewFormRecord,
  transactionPublishFormErrors,
} from './transactionForm';

const requiredMark = required();

const statusChoices = [
  { id: 'draft', name: 'app.status.draft' },
  { id: 'published', name: 'app.status.published' },
];

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

function useAccountCatalog() {
  const dataProvider = useDataProvider();
  const [accounts, setAccounts] = useState<AccountChoice[]>([]);
  const [isPending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAllAccounts((resource, params) =>
      dataProvider.getList(resource, params),
    )
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

function ReviewAccountInput({
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
        label={<AccountFieldLabel kind={kind} required />}
        source={source}
        translateChoice={false}
        validate={requiredMark}
      />
      {!isPending && !failed && choices.length === 0 ? (
        <Typography color="warning.main" variant="body2">
          {translate('app.accounts_seed_missing')}
        </Typography>
      ) : null}
    </Box>
  );
}

function ReviewEditableFields({
  catalog,
}: {
  catalog: ReturnType<typeof useAccountCatalog>;
}) {
  return (
    <>
      <DateInput fullWidth source="date" validate={requiredMark} />
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
          validate={requiredMark}
        />
      </ReferenceInput>
      <NumberInput fullWidth source="amount" validate={requiredMark} />
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
          validate={requiredMark}
        />
      </ReferenceInput>
      <TextInput
        className={bandedSpanClass}
        fullWidth
        multiline
        source="description"
        validate={requiredMark}
      />
      <ReviewAccountInput
        accounts={catalog.accounts}
        failed={catalog.failed}
        isPending={catalog.isPending}
        kind="credit"
        source="credit_account"
      />
      <ReviewAccountInput
        accounts={catalog.accounts}
        failed={catalog.failed}
        isPending={catalog.isPending}
        kind="debit"
        source="debit_account"
      />
    </>
  );
}

function DraftLeaveGuard() {
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const canBlock = useCanBlock();
  if (!canBlock) return null;
  return <DraftLeaveBlocker />;
}

function DraftLeaveBlocker() {
  const shouldBlock = useCallback(
    ({
      currentLocation,
      nextLocation,
    }: {
      currentLocation: { pathname: string };
      nextLocation: { pathname: string };
    }) =>
      shouldConfirmDraftLeave({
        isEditor: true,
        status: 'draft',
        currentPathname: currentLocation.pathname,
        nextPathname: nextLocation.pathname,
      }),
    [],
  );
  const blocker = useBlocker(shouldBlock);

  return (
    <Confirm
      cancel="app.transactions_leave_stay"
      confirm="app.transactions_leave_go"
      confirmColor="warning"
      content="app.transactions_leave_body"
      isOpen={blocker.state === 'blocked'}
      title="app.transactions_leave_title"
      onClose={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
    />
  );
}

function FinalizeSection({
  blocked,
  documentId,
  missingReceipt,
}: {
  blocked: boolean;
  documentId: string;
  missingReceipt: boolean;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const { getValues, setError, clearErrors } = useFormContext();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const onFinalize = () => {
    if (blocked || savingRef.current) return;

    const values = getValues() as Record<string, unknown>;
    clearErrors();
    const errors = transactionPublishFormErrors(values, translate);
    for (const [field, message] of Object.entries(errors)) {
      setError(field, { type: 'manual', message });
    }
    if (Object.keys(errors).length > 0) {
      notify('ra.message.invalid_form', { type: 'warning' });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    saveTransactionDraft(documentId, values)
      .then(() => publishTransaction(documentId))
      .then(() => {
        notify('app.transactions_finalized', { type: 'success' });
        refresh();
      })
      .catch((error: unknown) => {
        const message = strapiErrorMessage(error);
        notify(
          isSamePersonPublishError(message)
            ? 'app.transactions_finalize_same_person'
            : message || 'ra.notification.http_error',
          { type: 'error' },
        );
      })
      .finally(() => {
        savingRef.current = false;
        setSaving(false);
      });
  };

  return (
    <Box className={bandedSpanClass} sx={{ px: 1, pb: 1, pt: 0.5 }}>
      <Box component="fieldset" sx={reviewFieldset}>
        <Box component="legend" sx={reviewLegend}>
          <WarningAmberIcon aria-hidden sx={reviewIcon} />
          <Typography
            component="span"
            sx={{ fontWeight: 700 }}
            variant="subtitle1"
          >
            {translate('app.transactions_review')}
          </Typography>
        </Box>
        <Typography sx={{ mb: 1 }} variant="body2">
          {translate('app.transactions_finalize_hint')}
        </Typography>
        {missingReceipt ? (
          <Typography sx={{ fontWeight: 600, mb: 1 }} variant="body2">
            {translate('app.transactions_finalize_no_receipt')}
          </Typography>
        ) : null}
        {blocked ? (
          <Typography sx={{ fontWeight: 600, mb: 1 }} variant="body2">
            {translate('app.transactions_finalize_pending')}
          </Typography>
        ) : null}
        <Button
          disabled={blocked || saving}
          type="button"
          variant="contained"
          onClick={onFinalize}
        >
          {translate('app.transactions_finalize')}
        </Button>
      </Box>
    </Box>
  );
}

function ReceiptAttachEditor({
  cards,
  onCardsChange,
  record,
}: {
  cards: ReceiptCardValue[];
  onCardsChange: (cards: ReceiptCardValue[]) => void;
  record: TransactionRow;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const { getValues } = useFormContext();
  const [saving, setSaving] = useState(false);
  const pending = cards.filter((card) => card.file && card.file.size > 0);
  const values = getValues() as Record<string, unknown>;
  const formDescription =
    typeof values.description === 'string' ? values.description.trim() : '';
  const canSave = Boolean(
    pending.length > 0 &&
      !pending.some((card) => receiptCardInvalid(card)) &&
      formDescription &&
      values.date &&
      isFilled(values.amount),
  );

  const saveReceipts = () => {
    if (!canSave || saving) return;
    setSaving(true);
    Promise.all(
      pending.map((card) =>
        attachTransactionReceipt(record.documentId, {
          file: card.file as File,
          vendor: card.vendor,
          receiptTypeId: card.receiptTypeId,
          date: values.date,
          amount: values.amount,
          description: formDescription,
        }),
      ),
    )
      .then(() => {
        onCardsChange([]);
        notify('app.receipt_saved', { type: 'success' });
        refresh();
      })
      .catch((error: unknown) => {
        notify(strapiErrorMessage(error) || 'ra.notification.http_error', {
          type: 'error',
        });
      })
      .finally(() => setSaving(false));
  };

  return (
    <Box className={bandedSpanClass} sx={{ px: 1 }}>
      <ReceiptRail
        cards={cards}
        saved={record.receipts}
        onChange={onCardsChange}
      />
      {pending.length > 0 && !formDescription ? (
        <Typography color="error" variant="body2">
          {translate('app.receipt_description_required')}
        </Typography>
      ) : null}
      {pending.length > 0 ? (
        <Button
          disabled={!canSave || saving}
          sx={{ mt: 1 }}
          type="button"
          variant="contained"
          onClick={saveReceipts}
        >
          {translate('app.receipt_save')}
        </Button>
      ) : null}
    </Box>
  );
}

function reviewFieldset(theme: Theme) {
  const dark = theme.palette.mode === 'dark';
  return {
    backgroundColor: dark ? 'rgba(226, 177, 0, 0.16)' : '#FFF4CC',
    border: '2px solid',
    borderColor: dark ? '#E6C36A' : '#E2B100',
    borderRadius: 1,
    boxSizing: 'border-box',
    color: dark ? '#F6E7B2' : '#5C4810',
    m: 0,
    minWidth: 0,
    px: 2,
    py: 1.5,
    width: '100%',
  };
}

const reviewLegend = {
  alignItems: 'center',
  color: 'inherit',
  display: 'flex',
  gap: 0.75,
  px: 0.75,
};

function reviewIcon(theme: Theme) {
  return {
    color: theme.palette.mode === 'dark' ? '#F0D060' : '#C48A00',
    fontSize: 28,
  };
}

function isFilled(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim() !== '';
  return false;
}

export function TransactionReviewEditor({
  cards,
  locale,
  onCardsChange,
  record,
}: {
  cards: ReceiptCardValue[];
  locale: string;
  onCardsChange: (cards: ReceiptCardValue[]) => void;
  record: TransactionRow;
}) {
  const catalog = useAccountCatalog();
  const flatRecord = useMemo(() => reviewFormRecord(record), [record]);
  const pendingReceipt = cards.some((card) => card.file && card.file.size > 0);
  const blocked =
    pendingReceipt || cards.some((card) => receiptCardInvalid(card));
  const missingReceipt = receiptCount(record.receipts) === 0;

  return (
    <>
      <SimpleShowLayout spacing={0} sx={bandedShow}>
        <FunctionField
          render={(row: RaRecord) => firstReceiptVendor(row.receipts) || '—'}
          source="vendor"
        />
        <SelectField choices={statusChoices} source="status" translateChoice />
      </SimpleShowLayout>
      <SimpleForm
        key={record.documentId}
        record={flatRecord}
        sx={bandedForm}
        toolbar={false}
        onSubmit={() => undefined}
      >
        <DraftLeaveGuard />
        <ReviewEditableFields catalog={catalog} />
        <ReceiptAttachEditor
          cards={cards}
          record={record}
          onCardsChange={onCardsChange}
        />
        <FinalizeSection
          blocked={blocked}
          documentId={record.documentId}
          missingReceipt={missingReceipt}
        />
      </SimpleForm>
      <SimpleShowLayout spacing={0} sx={bandedShow}>
        <TextField emptyText="—" source="entered_by" />
        <DateField source="createdAt" {...dateFieldProps(locale, true)} />
      </SimpleShowLayout>
    </>
  );
}
