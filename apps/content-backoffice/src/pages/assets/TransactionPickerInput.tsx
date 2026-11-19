import { Autocomplete, Box, TextField } from '@mui/material';
import { strapiHttpClient } from 'ra-strapi';
import { useEffect, useMemo, useState } from 'react';
import {
  useGetOne,
  useInput,
  useRecordContext,
  useTranslate,
} from 'react-admin';
import { useWatch } from 'react-hook-form';

import type { AssetRecord } from '../../data/assetData';
import {
  searchTransactionsForPicker,
  transactionOptionLabel,
  type TransactionPickerOption,
  type TransactionPickerSide,
} from './transactionPicker';
import {
  loadTransactionUsage,
  overLinkedTotal,
  type TransactionUsage,
} from './transactionUsage';

const httpClient = strapiHttpClient({ storage: localStorage });
const usageNumber = new Intl.NumberFormat('hu-HU', {
  maximumFractionDigits: 2,
});

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
const SEARCH_DEBOUNCE_MS = 300;

type RefField = 'acquisition_transaction' | 'disposal_transaction';

/** Optional transaction link: search existing transactions, store documentId. */
export function TransactionPickerInput({
  source,
  side,
}: {
  source: RefField;
  side: TransactionPickerSide;
}) {
  const translate = useTranslate();
  const record = useRecordContext<AssetRecord>();
  const assetId = record?.documentId ?? null;
  const { field, fieldState } = useInput({ source });
  const value = typeof field.value === 'string' ? field.value : '';
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<TransactionPickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const knownRef =
    record?.refs?.[source]?.documentId === value ? record.refs[source] : null;
  const { data: fetched } = useGetOne(
    'transactions',
    { id: value },
    { enabled: Boolean(value) && !knownRef },
  );

  const selected = useMemo<TransactionPickerOption | null>(() => {
    if (!value) return null;
    if (knownRef) {
      return {
        id: value,
        label: transactionOptionLabel({
          documentId: value,
          date: knownRef.date,
          amount: knownRef.amount,
          description: knownRef.description,
          currency_type: { code: knownRef.currencyCode },
        }),
      };
    }
    if (fetched) {
      return {
        id: value,
        label: transactionOptionLabel(
          fetched as Parameters<typeof transactionOptionLabel>[0],
        ),
      };
    }
    return { id: value, label: value };
  }, [fetched, knownRef, value]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      searchTransactionsForPicker(httpClient, search, side, assetId)
        .then((rows) => {
          if (active) setOptions(rows);
        })
        .catch(() => {
          if (active) setOptions([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [assetId, open, search, side]);

  // Other assets already linked to the selected transaction (this one excluded).
  const [selectedUsage, setSelectedUsage] = useState<TransactionUsage>();
  useEffect(() => {
    if (!value) return;
    let active = true;
    loadTransactionUsage(httpClient, [value], side, assetId)
      .then((usage) => {
        if (active) setSelectedUsage(usage.get(value));
      })
      .catch(() => {
        if (active) setSelectedUsage(undefined);
      });
    return () => {
      active = false;
    };
  }, [assetId, side, value]);

  const ownPrice = toNumber(useWatch({ name: 'purchase_price' }));
  const selectedAmount = toNumber(
    knownRef?.amount ??
      (fetched as { amount?: unknown } | undefined)?.amount ??
      options.find((option) => option.id === value)?.amount,
  );
  const currency =
    knownRef?.currencyCode ??
    (fetched as { currency_type?: { code?: string | null } } | undefined)
      ?.currency_type?.code ??
    options.find((option) => option.id === value)?.currencyCode ??
    '';
  const overTotal =
    value && side === 'debit'
      ? overLinkedTotal(selectedUsage, ownPrice, selectedAmount)
      : null;

  const usageText = (
    usage: TransactionUsage | undefined,
    amount?: number | null,
    code?: string | null,
  ) =>
    usage && usage.assetCount > 0
      ? translate('app.assets.transaction_picker_usage', {
          count: usage.assetCount,
          linked: usageNumber.format(usage.linkedTotal),
          amount: amount == null ? '—' : usageNumber.format(amount),
          currency: code ?? '',
        })
      : null;

  const allOptions =
    selected && !options.some((option) => option.id === selected.id)
      ? [selected, ...options]
      : options;

  return (
    <Autocomplete
      filterOptions={(items) => items}
      fullWidth
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      loading={loading}
      loadingText={translate('ra.page.loading')}
      noOptionsText={translate('app.assets.transaction_picker_empty')}
      onChange={(_, option) => field.onChange(option?.id ?? null)}
      onClose={() => setOpen(false)}
      onInputChange={(_, text, reason) => {
        if (reason === 'input') setSearch(text);
        if (reason === 'clear') setSearch('');
      }}
      onOpen={() => setOpen(true)}
      open={open}
      options={allOptions}
      renderOption={(props, option) => {
        const { key, ...rest } = props as typeof props & { key: string };
        const usage = usageText(
          option.usage,
          option.amount,
          option.currencyCode,
        );
        return (
          <Box component="li" key={key} {...rest}>
            <Box>
              {option.label}
              {usage ? (
                <Box
                  component="span"
                  sx={{
                    color: 'warning.main',
                    display: 'block',
                    fontSize: '0.8125rem',
                  }}
                >
                  {usage}
                </Box>
              ) : null}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          error={Boolean(fieldState.error)}
          helperText={
            overTotal != null ? (
              <Box component="span" sx={{ color: 'warning.main' }}>
                {translate('app.assets.transaction_picker_over_linked', {
                  total: usageNumber.format(overTotal),
                  amount: usageNumber.format(selectedAmount ?? 0),
                  currency,
                })}
              </Box>
            ) : value && selectedUsage && selectedUsage.assetCount > 0 ? (
              usageText(selectedUsage, selectedAmount, currency)
            ) : (
              translate(`app.assets.transaction_picker_help_${side}`)
            )
          }
          label={translate(`resources.assets.fields.${source}`)}
          margin="dense"
          variant="filled"
        />
      )}
      value={selected}
    />
  );
}
