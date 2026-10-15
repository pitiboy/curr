import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import {
  Confirm,
  DateField,
  Form,
  FunctionField,
  ListButton,
  SelectField,
  Show,
  SimpleShowLayout,
  TextField,
  TopToolbar,
  useBlocker,
  useCanBlock,
  useLocaleState,
  useNotify,
  usePermissions,
  useRecordContext,
  useRefresh,
  useTranslate,
  type RaRecord,
} from 'react-admin';

import {
  attachTransactionReceipt,
  publishTransaction,
  saveTransactionDraft,
} from '../../data/dataProvider';
import { receiptCardInvalid, receiptIsPresent } from '../../data/receiptDraft';
import {
  isSamePersonPublishError,
  strapiErrorMessage,
} from '../../data/transactionPublish';
import {
  firstReceiptVendor,
  type TransactionRow,
} from '../../data/transactionList';
import { bandedForm, bandedShow, bandedSpanClass } from '../../theme';
import { AccountFieldLabel, AccountValue } from './accountField';
import { CurrencyValue } from './currencyField';
import { dateFieldProps } from './dateField';
import { ReceiptRail, SavedReceiptSection, type ReceiptCardValue } from './ReceiptFields';
import { transactionFormFields, useAccountCatalog } from './transactionFields';
import {
  TRANSACTION_PUBLISH_REQUIRED,
  transactionFormErrors,
  transactionReviewValues,
} from './transactionForm';
import { shouldConfirmDraftLeave } from './transactionLeave';

const statusChoices = [
  { id: 'draft', name: 'app.status.draft' },
  { id: 'published', name: 'app.status.published' },
];

function relationName(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const name = (value as { name?: string | null }).name;
  return name || '—';
}

function ShowActions() {
  return (
    <TopToolbar>
      <ListButton />
    </TopToolbar>
  );
}

export function TransactionShow() {
  return (
    <Show actions={<ShowActions />} title="app.transactions_show">
      <TransactionShowBody />
    </Show>
  );
}

function TransactionShowBody() {
  const record = useRecordContext<TransactionRow>();
  const { permissions, isPending } = usePermissions();
  const [locale] = useLocaleState();
  if (!record) return null;
  const locales = locale === 'en' ? 'en' : 'hu-HU';
  const canReview =
    !isPending && permissions === 'editor' && record.status === 'draft';

  return (
    <TransactionShowContent
      key={String(record.id)}
      canReview={canReview}
      locale={locale}
      locales={locales}
      record={record}
    />
  );
}

function TransactionShowContent({
  canReview,
  locale,
  locales,
  record,
}: {
  canReview: boolean;
  locale: string;
  locales: string;
  record: TransactionRow;
}) {
  const translate = useTranslate();
  const [cards, setCards] = useState<ReceiptCardValue[]>([]);
  const pending = cards.some((card) => card.file && card.file.size > 0);
  const finalize = useFinalizeTransaction(record.documentId, pending);
  const saved = hasSavedReceipts(record.receipts);
  const formRecord = {
    ...record,
    ...transactionReviewValues(record),
  };

  return (
    <Box>
      {canReview ? <DraftLeaveGuard /> : null}
      {canReview ? (
        <Form
          defaultValues={transactionReviewValues(record)}
          noValidate
          onSubmit={finalize.onSubmit}
          record={formRecord}
          validate={(values) =>
            transactionFormErrors(
              values as Record<string, unknown>,
              [],
              translate,
              TRANSACTION_PUBLISH_REQUIRED,
            )
          }
        >
          <ReviewFormBody
            blocked={pending}
            cards={cards}
            locale={locale}
            record={record}
            saving={finalize.saving}
            onCardsChange={setCards}
          />
        </Form>
      ) : (
        <ReadonlyBody
          locale={locale}
          locales={locales}
          record={record}
          saved={saved}
        />
      )}
    </Box>
  );
}

function ReviewFormBody({
  blocked,
  cards,
  locale,
  onCardsChange,
  record,
  saving,
}: {
  blocked: boolean;
  cards: ReceiptCardValue[];
  locale: string;
  onCardsChange: (cards: ReceiptCardValue[]) => void;
  record: TransactionRow;
  saving: boolean;
}) {
  const catalog = useAccountCatalog();

  return (
    <Box>
      <Box sx={{ px: 1, pt: 1 }}>
        <FinalizePanel blocked={blocked} saving={saving} />
      </Box>
      <Box sx={bandedForm}>
        <Stack>
          <FunctionField
            render={(row: RaRecord) => firstReceiptVendor(row.receipts) || '—'}
            source="vendor"
          />
          {transactionFormFields({ catalog, relationRequired: true })}
          <SelectField choices={statusChoices} source="status" translateChoice />
        </Stack>
      </Box>
      <Box
        sx={{ px: 1 }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault();
        }}
      >
        <ReceiptAttach cards={cards} record={record} onChange={onCardsChange} />
      </Box>
      <AuditFields locale={locale} record={record} />
      <Box sx={{ px: 1, pb: 1 }}>
        <Box sx={{ mt: 1 }}>
          <FinalizePanel blocked={blocked} saving={saving} />
        </Box>
      </Box>
    </Box>
  );
}

function ReadonlyBody({
  locale,
  locales,
  record,
  saved,
}: {
  locale: string;
  locales: string;
  record: TransactionRow;
  saved: boolean;
}) {
  const translate = useTranslate();

  return (
    <Box>
      <SimpleShowLayout spacing={0} sx={bandedShow}>
        <FunctionField
          render={(row: RaRecord) => firstReceiptVendor(row.receipts) || '—'}
          source="vendor"
        />
        <FunctionField
          render={(row: RaRecord) => relationName(row.organization)}
          source="organization"
        />

        <DateField source="date" {...dateFieldProps(locale)} />
        <FunctionField
          label="resources.transactions.fields.amount"
          render={(row: RaRecord) => (
            <Box
              component="span"
              sx={{
                alignItems: 'center',
                display: 'inline-flex',
                flexWrap: 'wrap',
                gap: 0.75,
                verticalAlign: 'middle',
              }}
            >
              <span>{formatAmount(row.amount, locales)}</span>
              <CurrencyValue value={row.currency_type} />
            </Box>
          )}
          source="amount"
        />
        <TextField emptyText="—" source="description" />

        <SelectField choices={statusChoices} source="status" translateChoice />

        <FunctionField
          label={<AccountFieldLabel kind="credit" />}
          render={(row: RaRecord) => (
            <AccountValue kind="credit" value={row.credit_account} />
          )}
          source="credit_account"
        />
        <FunctionField
          label={<AccountFieldLabel kind="debit" />}
          render={(row: RaRecord) => (
            <AccountValue kind="debit" value={row.debit_account} />
          )}
          source="debit_account"
        />
        {!saved ? (
          <FunctionField
            className={bandedSpanClass}
            label="resources.transactions.fields.receipt"
            render={() => translate('app.receipt_no')}
            source="receipts"
          />
        ) : null}
      </SimpleShowLayout>
      {saved ? (
        <Box sx={{ px: 1 }}>
          <SavedReceiptSection receipts={record.receipts} />
        </Box>
      ) : null}
      <AuditFields locale={locale} record={record} />
    </Box>
  );
}

function AuditFields({
  locale,
  record,
}: {
  locale: string;
  record: TransactionRow;
}) {
  return (
    <SimpleShowLayout spacing={0} sx={bandedShow}>
      <TextField emptyText="—" source="entered_by" />
      <DateField source="createdAt" {...dateFieldProps(locale, true)} />
      {record.status === 'published' ? (
        <TextField emptyText="—" source="published_by" />
      ) : null}
      {record.status === 'published' ? (
        <DateField
          emptyText="—"
          source="publishedAt"
          {...dateFieldProps(locale, true)}
        />
      ) : null}
    </SimpleShowLayout>
  );
}

function blockDraftLeave({
  currentLocation,
  nextLocation,
}: {
  currentLocation: { pathname: string };
  nextLocation: { pathname: string };
}): boolean {
  return shouldConfirmDraftLeave({
    isEditor: true,
    status: 'draft',
    currentPathname: currentLocation.pathname,
    nextPathname: nextLocation.pathname,
  });
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
  const blocker = useBlocker(blockDraftLeave);

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

function ReceiptAttach({
  cards,
  onChange,
  record,
}: {
  cards: ReceiptCardValue[];
  onChange: (cards: ReceiptCardValue[]) => void;
  record: TransactionRow;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [saving, setSaving] = useState(false);
  const watchedDate = useWatch({ name: 'date' });
  const watchedAmount = useWatch({ name: 'amount' });
  const watchedDescription = useWatch({ name: 'description' });
  const date = watchedDate ?? record.date;
  const amount = watchedAmount ?? record.amount;
  const description =
    typeof watchedDescription === 'string'
      ? watchedDescription.trim()
      : typeof record.description === 'string'
        ? record.description.trim()
        : '';
  const pending = cards.filter((card) => card.file && card.file.size > 0);
  const canSave = Boolean(
    pending.length > 0 &&
      !pending.some((card) => receiptCardInvalid(card)) &&
      description &&
      date &&
      isFilled(amount),
  );

  return (
    <Box>
      <ReceiptRail cards={cards} saved={record.receipts} onChange={onChange} />
      {pending.length > 0 && !description ? (
        <Typography color="error" variant="body2">
          {translate('app.receipt_description_required')}
        </Typography>
      ) : null}
      {pending.length > 0 ? (
        <Button
          disabled={!canSave || saving}
          onClick={() => {
            if (!canSave || saving) return;
            setSaving(true);
            Promise.all(
              pending.map((card) =>
                attachTransactionReceipt(record.documentId, {
                  file: card.file as File,
                  vendor: card.vendor,
                  receiptTypeId: card.receiptTypeId,
                  date,
                  amount,
                  description,
                }),
              ),
            )
              .then(() => {
                onChange([]);
                notify('app.receipt_saved', { type: 'success' });
                refresh();
              })
              .catch((error: unknown) => {
                notify(errorText(error, translate('ra.notification.http_error')), {
                  type: 'error',
                });
              })
              .finally(() => setSaving(false));
          }}
          sx={{ mt: 1 }}
          type="button"
          variant="contained"
        >
          {translate('app.receipt_save')}
        </Button>
      ) : null}
    </Box>
  );
}

function useFinalizeTransaction(documentId: string, blocked: boolean) {
  const notify = useNotify();
  const refresh = useRefresh();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const onSubmit = (values: Record<string, unknown>) => {
    if (blocked || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    let updated = false;
    saveTransactionDraft(documentId, values)
      .then(() => {
        updated = true;
        return publishTransaction(documentId);
      })
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
        if (updated) refresh();
      })
      .finally(() => {
        savingRef.current = false;
        setSaving(false);
      });
  };

  return { saving, onSubmit };
}

function FinalizePanel({
  blocked,
  saving,
}: {
  blocked: boolean;
  saving: boolean;
}) {
  const translate = useTranslate();

  return (
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

function errorText(error: unknown, fallback: string): string {
  const message = strapiErrorMessage(error);
  return message || (error instanceof Error ? error.message : fallback);
}

function hasSavedReceipts(receipts: unknown): boolean {
  return (
    Array.isArray(receipts) && receipts.some((item) => receiptIsPresent(item))
  );
}

function formatAmount(value: unknown, locales: string): string {
  if (value === null || value === undefined || value === '') return '—';
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat(locales).format(amount);
}

function isFilled(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim() !== '';
  return false;
}
