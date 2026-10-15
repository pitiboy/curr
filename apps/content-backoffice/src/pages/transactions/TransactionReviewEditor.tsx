import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Button, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  AutocompleteInput,
  Confirm,
  DateField,
  DateInput,
  Form,
  FunctionField,
  NumberInput,
  ReferenceInput,
  SelectField,
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
import { receiptCardInvalid } from '../../data/receiptDraft';
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
  reviewFormDefaults,
  transactionPublishFormErrors,
} from './transactionForm';

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
        label={<AccountFieldLabel kind={kind} />}
        source={source}
        translateChoice={false}
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
    <Box sx={bandedForm}>
      <DateInput fullWidth source="date" />
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
      <NumberInput fullWidth source="amount" />
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
        />
      </ReferenceInput>
      <TextInput className={bandedSpanClass} fullWidth multiline source="description" />
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
    </Box>
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
}: {
  blocked: boolean;
  documentId: string;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const { getValues, setError, clearErrors } = useFormContext();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blocked || savingRef.current) return;

    const values = getValues() as Record<string, unknown>;
    clearErrors();
    const errors = transactionPublishFormErrors(values, translate);
    for (const [field, message] of Object.entries(errors)) {
      setError(field, { type: 'manual', message });
    }
    if (Object.keys(errors).length > 0) {
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
    <Box component="form" onSubmit={onSubmit} sx={{ px: 1, pb: 1, pt: 1 }}>
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
        {blocked ? (
          <Typography sx={{ fontWeight: 600, mb: 1 }} variant="body2">
            {translate('app.transactions_finalize_pending')}
          </Typography>
        ) : null}
        <Button disabled={blocked || saving} type="submit" variant="contained">
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

  return (
    <Box sx={{ px: 1 }}>
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
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
        }}
      >
        <ReceiptRail cards={cards} saved={record.receipts} onChange={onCardsChange} />
        {pending.length > 0 && !formDescription ? (
          <Typography color="error" variant="body2">
            {translate('app.receipt_description_required')}
          </Typography>
        ) : null}
        {pending.length > 0 ? (
          <Button
            disabled={!canSave || saving}
            sx={{ mt: 1 }}
            type="submit"
            variant="contained"
          >
            {translate('app.receipt_save')}
          </Button>
        ) : null}
      </Box>
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
  const pendingReceipt = cards.some((card) => card.file && card.file.size > 0);
  const blocked =
    pendingReceipt || cards.some((card) => receiptCardInvalid(card));

  return (
    <Form defaultValues={reviewFormDefaults(record)}>
      <DraftLeaveGuard />
      <SimpleShowLayout spacing={0} sx={bandedShow}>
        <FunctionField
          render={(row: RaRecord) => firstReceiptVendor(row.receipts) || '—'}
          source="vendor"
        />
      </SimpleShowLayout>
      <Box sx={{ px: 1 }}>
        <ReviewEditableFields catalog={catalog} />
      </Box>
      <SimpleShowLayout spacing={0} sx={bandedShow}>
        <SelectField choices={statusChoices} source="status" translateChoice />
      </SimpleShowLayout>
      <ReceiptAttachEditor
        cards={cards}
        record={record}
        onCardsChange={onCardsChange}
      />
      <SimpleShowLayout spacing={0} sx={bandedShow}>
        <TextField emptyText="—" source="entered_by" />
        <DateField source="createdAt" {...dateFieldProps(locale, true)} />
      </SimpleShowLayout>
      <FinalizeSection blocked={blocked} documentId={record.documentId} />
    </Form>
  );
}
