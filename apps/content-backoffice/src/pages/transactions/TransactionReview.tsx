import { Box, Button, Typography } from '@mui/material';
import { useState } from 'react';
import {
  Title,
  useGetList,
  useLocaleState,
  useNotify,
  useTranslate,
} from 'react-admin';

import { attachTransactionReceipt } from '../../data/dataProvider';
import type { TransactionRow } from '../../data/transactionList';
import { EmptyState } from '../EmptyState';
import { ReceiptFields, ReceiptLink } from './ReceiptFields';

const draftListParams = {
  pagination: { page: 1, perPage: 100 },
  sort: { field: 'date', order: 'DESC' as const },
  filter: { status: 'draft' },
};

/** Editor view: open a draft receipt, or attach one. No publish action. */
export function TransactionReview() {
  const translate = useTranslate();
  const [locale] = useLocaleState();
  const { data, isPending, error, refetch } = useGetList<TransactionRow>(
    'transactions',
    draftListParams,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = data ?? [];
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  if (isPending) {
    return (
      <Box sx={{ p: 2 }}>
        <Title title="app.transactions_review" />
        <Typography color="text.secondary">
          {translate('ra.page.loading')}
        </Typography>
      </Box>
    );
  }

  if (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      <Box sx={{ p: 2 }}>
        <Title title="app.transactions_review" />
        <Typography color="error">{message}</Typography>
      </Box>
    );
  }

  if (!selected) {
    return (
      <EmptyState
        bodyKey="app.transactions_review_empty"
        titleKey="app.transactions_review"
      />
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Title title="app.transactions_review" />
      <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
        {translate('app.transactions_review_hint')}
      </Typography>
      <Box
        sx={{
          color: 'text.secondary',
          display: { xs: 'none', sm: 'grid' },
          gap: 2,
          gridTemplateColumns: '8rem 6rem 1fr auto',
          mb: 0.5,
          px: 1,
        }}
      >
        <span>{translate('resources.transactions.fields.date')}</span>
        <span>{translate('resources.transactions.fields.amount')}</span>
        <span>{translate('resources.transactions.fields.description')}</span>
        <span>{translate('resources.transactions.fields.receipt')}</span>
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, mb: 3, p: 0 }}>
        {rows.map((row) => {
          const active = row.id === selected.id;
          return (
            <Box
              component="li"
              key={row.id}
              sx={{
                bgcolor: active ? 'action.selected' : 'transparent',
                borderRadius: 1,
                cursor: 'pointer',
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr 1fr', sm: '8rem 6rem 1fr auto' },
                mb: 0.5,
                px: 1,
                py: 0.75,
              }}
              onClick={() => setSelectedId(row.id)}
            >
              <span>{row.date || '—'}</span>
              <span>{formatAmount(row.amount, locale)}</span>
              <span>{row.description || '—'}</span>
              <ReceiptLink receipt={row.receipt} />
            </Box>
          );
        })}
      </Box>
      <ReviewReceiptForm
        key={`${selected.id}:${selected.receipt?.documentId ?? ''}`}
        row={selected}
        onSaved={() => refetch()}
      />
    </Box>
  );
}

function ReviewReceiptForm({
  row,
  onSaved,
}: {
  row: TransactionRow;
  onSaved: () => void | Promise<unknown>;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const [file, setFile] = useState<File | null>(null);
  const [vendor, setVendor] = useState('');
  const [saving, setSaving] = useState(false);
  const description =
    typeof row.description === 'string' ? row.description.trim() : '';
  const canSave = Boolean(file && description && row.date && isFilled(row.amount));

  return (
    <Box
      component="form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!file || !canSave || saving) return;
        setSaving(true);
        attachTransactionReceipt(row.documentId, {
          file,
          vendor,
          date: row.date,
          amount: row.amount,
          description,
        })
          .then(async () => {
            setFile(null);
            setVendor('');
            notify('app.receipt_saved', { type: 'success' });
            await onSaved();
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error
                ? error.message
                : translate('ra.notification.http_error');
            notify(message, { type: 'error' });
          })
          .finally(() => setSaving(false));
      }}
    >
      <Typography sx={{ mb: 1 }} variant="subtitle1">
        {row.date || '—'}
        {row.description ? ` — ${row.description}` : ''}
      </Typography>
      <ReceiptLink receipt={row.receipt} />
      <ReceiptFields
        file={file}
        vendor={vendor}
        onFile={setFile}
        onVendor={setVendor}
      />
      {file && !description ? (
        <Typography color="error" variant="body2">
          {translate('app.receipt_description_required')}
        </Typography>
      ) : null}
      {file ? (
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

function formatAmount(value: unknown, locale: string): string {
  if (value == null || value === '') return '—';
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString(locale === 'en' ? 'en' : 'hu-HU');
}

function isFilled(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim() !== '';
  return false;
}
