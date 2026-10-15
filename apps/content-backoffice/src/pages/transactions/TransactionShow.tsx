import { Box, Button, Typography } from '@mui/material';
import { useState } from 'react';
import {
  DateField,
  FunctionField,
  ListButton,
  NumberField,
  SelectField,
  Show,
  SimpleShowLayout,
  TextField,
  TopToolbar,
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
} from '../../data/dataProvider';
import { receiptCardInvalid } from '../../data/receiptDraft';
import {
  isSamePersonPublishError,
  strapiErrorMessage,
} from '../../data/transactionPublish';
import type { TransactionRow } from '../../data/transactionList';
import { bandedShow } from '../../theme';
import {
  ReceiptFileList,
  ReceiptRail,
  type ReceiptCardValue,
} from './ReceiptFields';

const statusChoices = [
  { id: 'draft', name: 'app.status.draft' },
  { id: 'published', name: 'app.status.published' },
];

function relationName(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const name = (value as { name?: string | null }).name;
  return name || '—';
}

function accountLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const account = value as { code?: string | null; name?: string | null };
  return [account.code, account.name].filter(Boolean).join(' ') || '—';
}

function currencyLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const currency = value as { code?: string | null; name?: string | null };
  return [currency.code, currency.name].filter(Boolean).join(' ') || '—';
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
    <Box>
      <SimpleShowLayout sx={bandedShow}>
        <DateField locales={locales} source="date" />
        <NumberField locales={locales} source="amount" />
        <FunctionField
          render={(row: RaRecord) => currencyLabel(row.currency_type)}
          source="currency_type"
        />
        <TextField emptyText="—" source="description" />
        <FunctionField
          render={(row: RaRecord) => relationName(row.organization)}
          source="organization"
        />
        <FunctionField
          render={(row: RaRecord) => accountLabel(row.debit_account)}
          source="debit_account"
        />
        <FunctionField
          render={(row: RaRecord) => accountLabel(row.credit_account)}
          source="credit_account"
        />
        <SelectField choices={statusChoices} source="status" translateChoice />
        <FunctionField
          label="resources.transactions.fields.receipt"
          render={(row: RaRecord) => <ReceiptFileList receipts={row.receipts} />}
          source="receipts"
        />
        <TextField emptyText="—" source="entered_by" />
        <DateField locales={locales} showTime source="createdAt" />
        {record.status === 'published' ? (
          <TextField emptyText="—" source="published_by" />
        ) : null}
        {record.status === 'published' ? (
          <DateField
            emptyText="—"
            locales={locales}
            showTime
            source="publishedAt"
          />
        ) : null}
      </SimpleShowLayout>
      {canReview ? <DraftReview key={record.id} /> : null}
    </Box>
  );
}

function DraftReview() {
  const record = useRecordContext<TransactionRow>();
  const [cards, setCards] = useState<ReceiptCardValue[]>([]);
  if (!record) return null;
  const pending = cards.some((card) => card.file && card.file.size > 0);
  return (
    <Box sx={{ px: 2, pb: 2 }}>
      <ReceiptAttach
        cards={cards}
        record={record}
        onChange={setCards}
      />
      <FinalizeForm blocked={pending} documentId={record.documentId} />
    </Box>
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
  const description =
    typeof record.description === 'string' ? record.description.trim() : '';
  const pending = cards.filter((card) => card.file && card.file.size > 0);
  const canSave = Boolean(
    pending.length > 0 &&
      !pending.some((card) => receiptCardInvalid(card)) &&
      description &&
      record.date &&
      isFilled(record.amount),
  );

  return (
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
              date: record.date,
              amount: record.amount,
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
    >
      <ReceiptRail cards={cards} onChange={onChange} />
      {pending.length > 0 && !description ? (
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
  );
}

function FinalizeForm({
  blocked,
  documentId,
}: {
  blocked: boolean;
  documentId: string;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [saving, setSaving] = useState(false);

  return (
    <Box
      component="form"
      sx={{ mt: 3 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (blocked || saving) return;
        setSaving(true);
        publishTransaction(documentId)
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
          .finally(() => setSaving(false));
      }}
    >
      <Typography component="h2" variant="subtitle1">
        {translate('app.transactions_review')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1 }} variant="body2">
        {translate('app.transactions_finalize_hint')}
      </Typography>
      {blocked ? (
        <Typography color="warning.main" sx={{ mb: 1 }} variant="body2">
          {translate('app.transactions_finalize_pending')}
        </Typography>
      ) : null}
      <Button
        disabled={blocked || saving}
        type="submit"
        variant="contained"
      >
        {translate('app.transactions_finalize')}
      </Button>
    </Box>
  );
}

function errorText(error: unknown, fallback: string): string {
  const message = strapiErrorMessage(error);
  return message || (error instanceof Error ? error.message : fallback);
}

function isFilled(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim() !== '';
  return false;
}
