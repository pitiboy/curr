import {
  Box,
  Button,
  Link,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useDataProvider, useTranslate } from 'react-admin';

import { STRAPI_URL } from '../../config';
import { withBands } from '../../theme';
import {
  receiptCardInvalid,
  receiptDocumentUrl,
  receiptIsPresent,
} from '../../data/receiptDraft';

export type ReceiptCardValue = {
  key: string;
  file: File | null;
  vendor: string;
  receiptTypeId: string;
};

type ReceiptTypeChoice = { id: string; name: string };

function emptyReceiptCard(): ReceiptCardValue {
  return {
    key: crypto.randomUUID(),
    file: null,
    vendor: '',
    receiptTypeId: '',
  };
}

type ReceiptRailProps = {
  cards: ReceiptCardValue[];
  onChange: (cards: ReceiptCardValue[]) => void;
};

/** Horizontal card rail. Narrow screens stack the cards. */
export function ReceiptRail({ cards, onChange }: ReceiptRailProps) {
  const translate = useTranslate();
  const types = useReceiptTypes();

  function update(key: string, patch: Partial<ReceiptCardValue>) {
    onChange(cards.map((card) => (card.key === key ? { ...card, ...patch } : card)));
  }

  return (
    <Box sx={{ maxWidth: '100%', minInlineSize: 0, minWidth: 0, mt: 2, width: '100%' }}>
      <Box
        component="fieldset"
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          boxSizing: 'border-box',
          contain: 'inline-size',
          m: 0,
          maxWidth: '100%',
          minInlineSize: 0,
          minWidth: 0,
          p: 2,
          width: '100%',
        }}
      >
        <Typography component="legend" sx={{ px: 0.5 }} variant="subtitle1">
          {translate('app.receipt_block')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 1 }} variant="body2">
          {translate('app.receipt_optional')} {translate('app.receipt_prefill')}
        </Typography>
        <Box
          sx={{
            maxWidth: '100%',
            minWidth: 0,
            overflowX: { xs: 'visible', sm: 'auto' },
            overflowY: 'hidden',
          }}
        >
          <Box
            sx={withBands({
              alignItems: 'stretch',
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              pb: 1,
              width: { xs: '100%', sm: 'max-content' },
            })}
          >
            {cards.map((card) => (
              <ReceiptCard
                card={card}
                key={card.key}
                types={types}
                onChange={(patch) => update(card.key, patch)}
                onRemove={() =>
                  onChange(cards.filter((item) => item.key !== card.key))
                }
              />
            ))}
            <Box
              sx={{
                alignItems: 'center',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                boxSizing: 'border-box',
                display: 'flex',
                flex: { xs: '1 1 auto', sm: '0 0 16rem' },
                justifyContent: 'center',
                minHeight: '8rem',
                minWidth: 0,
                p: 2,
                width: { xs: '100%', sm: '16rem' },
              }}
            >
              <Button
                type="button"
                variant="outlined"
                onClick={() => onChange([...cards, emptyReceiptCard()])}
              >
                {translate('app.receipt_add')}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function ReceiptCard({
  card,
  types,
  onChange,
  onRemove,
}: {
  card: ReceiptCardValue;
  types: ReceiptTypeChoice[];
  onChange: (patch: Partial<ReceiptCardValue>) => void;
  onRemove: () => void;
}) {
  const translate = useTranslate();
  const invalid = receiptCardInvalid(card);

  return (
    <Box
      sx={{
        border: 1,
        borderColor: invalid ? 'error.main' : 'divider',
        borderRadius: 1,
        boxSizing: 'border-box',
        display: 'flex',
        flex: { xs: '1 1 auto', sm: '0 0 18rem' },
        flexDirection: 'column',
        gap: 1,
        minWidth: 0,
        overflow: 'hidden',
        p: 2,
        width: { xs: '100%', sm: '18rem' },
      }}
    >
      <TextField
        error={Boolean(card.file && !card.receiptTypeId)}
        fullWidth
        label={translate('app.receipt_type')}
        select
        size="small"
        value={card.receiptTypeId}
        onChange={(event) => onChange({ receiptTypeId: event.target.value })}
      >
        {types.map((type) => (
          <MenuItem key={type.id} value={type.id}>
            {type.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        error={Boolean(card.file && !card.vendor.trim())}
        fullWidth
        label={translate('app.receipt_vendor')}
        size="small"
        value={card.vendor}
        onChange={(event) => onChange({ vendor: event.target.value })}
      />
      <Button component="label" size="small" type="button" variant="outlined">
        {translate('app.receipt_file')}
        <input
          hidden
          type="file"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            onChange({ file: next && next.size > 0 ? next : null });
            event.target.value = '';
          }}
        />
      </Button>
      <Typography color="text.secondary" variant="body2">
        {card.file ? card.file.name : translate('app.receipt_skip')}
      </Typography>
      {invalid ? (
        <Typography color="error" variant="body2">
          {translate('app.receipt_card_required')}
        </Typography>
      ) : null}
      <Button size="small" type="button" onClick={onRemove}>
        {translate('app.receipt_remove')}
      </Button>
    </Box>
  );
}

function useReceiptTypes(): ReceiptTypeChoice[] {
  const dataProvider = useDataProvider();
  const [types, setTypes] = useState<ReceiptTypeChoice[]>([]);

  useEffect(() => {
    let cancelled = false;
    dataProvider
      .getList('receipt-types', {
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'name', order: 'ASC' },
        filter: {},
      })
      .then(({ data }) => {
        if (cancelled) return;
        setTypes(
          data
            .map((row) => ({
              id: String(row.id ?? ''),
              name: typeof row.name === 'string' ? row.name : '',
            }))
            .filter((row) => row.id && row.name),
        );
      })
      .catch(() => {
        if (!cancelled) setTypes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dataProvider]);

  return types;
}

export function ReceiptFileList({ receipts }: { receipts: unknown }) {
  const translate = useTranslate();
  const items = Array.isArray(receipts) ? receipts : [];
  if (items.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        {translate('app.receipt_no')}
      </Typography>
    );
  }
  return (
    <Box component="ul" sx={{ m: 0, mb: 1, pl: 2 }}>
      {items.map((receipt, index) => (
        <Box
          component="li"
          key={receiptKey(receipt, index)}
          sx={{ mb: 0.5 }}
        >
          {receiptTypeName(receipt) ? `${receiptTypeName(receipt)} · ` : null}
          <ReceiptLink receipt={receipt} />
        </Box>
      ))}
    </Box>
  );
}

export function ReceiptLink({ receipt }: { receipt: unknown }) {
  const translate = useTranslate();
  const url = receiptDocumentUrl(receipt, STRAPI_URL);
  if (!receiptIsPresent(receipt)) {
    return <>{translate('app.receipt_no')}</>;
  }
  if (!url) {
    return <>{translate('app.receipt_yes')}</>;
  }
  return (
    <Link
      href={url}
      rel="noopener noreferrer"
      target="_blank"
      onClick={(event) => event.stopPropagation()}
    >
      {translate('app.receipt_open')}
    </Link>
  );
}

function receiptTypeName(receipt: unknown): string {
  if (!receipt || typeof receipt !== 'object' || !('receipt_type' in receipt)) {
    return '';
  }
  const type = (receipt as { receipt_type?: { name?: unknown } | null }).receipt_type;
  return type && typeof type.name === 'string' ? type.name : '';
}

function receiptKey(receipt: unknown, index: number): string {
  if (receipt && typeof receipt === 'object' && 'documentId' in receipt) {
    const id = (receipt as { documentId?: unknown }).documentId;
    if (typeof id === 'string' && id) return id;
  }
  return String(index);
}
