import { Autocomplete, TextField } from '@mui/material';
import { strapiHttpClient } from 'ra-strapi';
import { useEffect, useMemo, useState } from 'react';
import {
  useGetOne,
  useInput,
  useRecordContext,
  useTranslate,
} from 'react-admin';

import type { AssetRecord } from '../../data/assetData';
import {
  searchTransactionsForPicker,
  transactionOptionLabel,
  type TransactionPickerOption,
  type TransactionPickerSide,
} from './transactionPicker';

const httpClient = strapiHttpClient({ storage: localStorage });
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
      searchTransactionsForPicker(httpClient, search, side)
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
  }, [open, search, side]);

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
      renderInput={(params) => (
        <TextField
          {...params}
          error={Boolean(fieldState.error)}
          helperText={translate(`app.assets.transaction_picker_help_${side}`)}
          label={translate(`resources.assets.fields.${source}`)}
          margin="dense"
          variant="filled"
        />
      )}
      value={selected}
    />
  );
}
