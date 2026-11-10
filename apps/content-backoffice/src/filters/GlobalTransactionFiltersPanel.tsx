import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  Menu,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  useGetList,
  useGetOne,
  useTranslate,
  type RaRecord,
} from 'react-admin';

import {
  CONVERTED_TO_WORKFLOW_CHOICES,
  type ConvertedFilterValue,
} from '../data/transactionList';
import { ReportTransactionStatusFilterControl } from '../pages/reports/components/ReportTransactionStatusFilter';
import {
  REPORT_RANGE_PRESETS,
  type DateRangePreset,
} from '../pages/reports/shared/reportDateRange';
import {
  clearOptionalFilter,
  GLOBAL_OPTIONAL_FILTER_KEYS,
  optionalFilterHasValue,
  resetGlobalFilters,
  selectDatePreset,
  setCustomDate,
  type GlobalOptionalFilterKey,
  type GlobalTransactionFilters as GlobalFilterState,
} from './globalTransactionFilters';
import { useGlobalTransactionFilters } from './globalTransactionFiltersAtom';

const TEXT_COMMIT_DELAY_MS = 400;

const OPTIONAL_FILTER_LABEL: Record<GlobalOptionalFilterKey, string> = {
  date: 'app.filters.custom_date',
  createdAt: 'resources.transactions.fields.createdAt',
  amount: 'resources.transactions.fields.amount',
  organization: 'resources.transactions.fields.organization',
  debit_account: 'resources.transactions.fields.debit_account',
  credit_account: 'resources.transactions.fields.credit_account',
  description: 'resources.transactions.fields.description',
  vendor: 'resources.transactions.fields.vendor',
};

/** Sidebar panel: global transaction filters for the list and the reports. */
export function GlobalTransactionFiltersPanel() {
  const translate = useTranslate();
  const [state, setState] = useGlobalTransactionFilters();
  const [added, setAdded] = useState<GlobalOptionalFilterKey[]>([]);

  const visible = GLOBAL_OPTIONAL_FILTER_KEYS.filter(
    (key) => added.includes(key) || optionalFilterHasValue(state, key),
  );
  const addable = GLOBAL_OPTIONAL_FILTER_KEYS.filter(
    (key) => !visible.includes(key),
  );

  const update = (patch: Partial<GlobalFilterState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const removeOptional = (key: GlobalOptionalFilterKey) => {
    setAdded((prev) => prev.filter((item) => item !== key));
    setState((prev) => clearOptionalFilter(prev, key));
  };

  return (
    <Stack
      aria-label={translate('app.filters.panel_title')}
      component="section"
      spacing={1.5}
      sx={{ px: 1.5, py: 1.5 }}
    >
      <Typography color="text.secondary" variant="overline">
        {translate('app.filters.panel_title')}
      </Typography>

      <ToggleButtonGroup
        aria-label={translate('resources.transactions.fields.date')}
        color="primary"
        exclusive
        onChange={(_e, value: DateRangePreset | null) => {
          if (value) setState((prev) => selectDatePreset(prev, value));
        }}
        size="small"
        sx={{
          flexWrap: 'wrap',
          '& .MuiToggleButton-root': { flexGrow: 1, px: 1, py: 0.25 },
        }}
        value={state.datePreset === 'custom' ? null : state.datePreset}
      >
        {REPORT_RANGE_PRESETS.map((preset) => (
          <ToggleButton key={preset} value={preset}>
            {translate(`app.reports.range.${preset}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <ReportTransactionStatusFilterControl
        onChange={(status) => update({ status })}
        sx={{ minWidth: 0 }}
        value={state.status}
      />

      <ConvertedSelect
        onChange={(converted_to_workflow) => update({ converted_to_workflow })}
        value={state.converted_to_workflow}
      />

      {visible.map((key) => (
        <OptionalFilterRow
          key={key}
          label={translate(OPTIONAL_FILTER_LABEL[key])}
          onRemove={() => removeOptional(key)}
        >
          <OptionalFilterInput
            filterKey={key}
            setState={setState}
            state={state}
          />
        </OptionalFilterRow>
      ))}

      {state.drilldown ? (
        <Chip
          label={translate('app.filters.report_drilldown')}
          onDelete={() =>
            setState((prev) => {
              const next = { ...prev };
              delete next.drilldown;
              return next;
            })
          }
          size="small"
          sx={{ alignSelf: 'flex-start' }}
          variant="outlined"
        />
      ) : null}

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <AddFilterButton
          keys={addable}
          onAdd={(key) => setAdded((prev) => [...prev, key])}
        />
        <Button
          onClick={() => {
            setAdded([]);
            setState(resetGlobalFilters());
          }}
          size="small"
          variant="outlined"
        >
          {translate('app.filters.clear')}
        </Button>
      </Stack>
    </Stack>
  );
}

function ConvertedSelect({
  value,
  onChange,
}: {
  value: ConvertedFilterValue[];
  onChange: (value: ConvertedFilterValue[]) => void;
}) {
  const translate = useTranslate();
  const label = translate(
    'resources.transactions.fields.converted_to_workflow',
  );
  return (
    <FormControl size="small">
      <InputLabel id="global-converted-filter-label">{label}</InputLabel>
      <Select<ConvertedFilterValue[]>
        input={<OutlinedInput label={label} />}
        labelId="global-converted-filter-label"
        multiple
        onChange={(event: SelectChangeEvent<ConvertedFilterValue[]>) => {
          const raw = event.target.value;
          onChange(
            (typeof raw === 'string'
              ? raw.split(',')
              : raw) as ConvertedFilterValue[],
          );
        }}
        renderValue={(selected) =>
          selected.map((item) => translate(`app.converted.${item}`)).join(', ')
        }
        value={value}
      >
        {CONVERTED_TO_WORKFLOW_CHOICES.map((choice) => (
          <MenuItem key={choice} value={choice}>
            <ListItemText primary={translate(`app.converted.${choice}`)} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function AddFilterButton({
  keys,
  onAdd,
}: {
  keys: readonly GlobalOptionalFilterKey[];
  onAdd: (key: GlobalOptionalFilterKey) => void;
}) {
  const translate = useTranslate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        disabled={keys.length === 0}
        onClick={(event) => setAnchor(event.currentTarget)}
        size="small"
        startIcon={<AddIcon />}
        variant="text"
      >
        {translate('app.filters.add')}
      </Button>
      <Menu anchorEl={anchor} onClose={() => setAnchor(null)} open={!!anchor}>
        {keys.map((key) => (
          <MenuItem
            key={key}
            onClick={() => {
              setAnchor(null);
              onAdd(key);
            }}
          >
            {translate(OPTIONAL_FILTER_LABEL[key])}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function OptionalFilterRow({
  label,
  onRemove,
  children,
}: {
  label: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const translate = useTranslate();
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      <Tooltip title={`${translate('app.filters.remove')}: ${label}`}>
        <IconButton
          aria-label={`${translate('app.filters.remove')}: ${label}`}
          onClick={onRemove}
          size="small"
          sx={{ mt: 0.5 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

type SetState = (
  update: (prev: GlobalFilterState) => GlobalFilterState,
) => void;

function OptionalFilterInput({
  filterKey,
  state,
  setState,
}: {
  filterKey: GlobalOptionalFilterKey;
  state: GlobalFilterState;
  setState: SetState;
}) {
  const translate = useTranslate();
  const setField = <K extends keyof GlobalFilterState>(
    key: K,
    value: GlobalFilterState[K] | undefined,
  ) =>
    setState((prev) => {
      const next = { ...prev };
      if (value == null || value === '') delete next[key];
      else next[key] = value as GlobalFilterState[K];
      return next;
    });

  switch (filterKey) {
    case 'date':
      return (
        <RangeInputs
          fromLabel={translate('app.filters.date_from')}
          fromValue={state.datePreset === 'custom' ? state.date_gte : undefined}
          onFrom={(value) =>
            setState((prev) => setCustomDate(prev, 'date_gte', value))
          }
          onTo={(value) =>
            setState((prev) => setCustomDate(prev, 'date_lte', value))
          }
          toLabel={translate('app.filters.date_to')}
          toValue={state.datePreset === 'custom' ? state.date_lte : undefined}
          type="date"
        />
      );
    case 'createdAt':
      return (
        <RangeInputs
          fromLabel={translate('app.filters.created_from')}
          fromValue={state.createdAt_gte}
          onFrom={(value) => setField('createdAt_gte', value)}
          onTo={(value) => setField('createdAt_lte', value)}
          toLabel={translate('app.filters.created_to')}
          toValue={state.createdAt_lte}
          type="date"
        />
      );
    case 'amount':
      return (
        <RangeInputs
          fromLabel={translate('app.filters.amount_from')}
          fromValue={state.amount_gte?.toString()}
          onFrom={(value) => setField('amount_gte', parseAmount(value))}
          onTo={(value) => setField('amount_lte', parseAmount(value))}
          toLabel={translate('app.filters.amount_to')}
          toValue={state.amount_lte?.toString()}
          type="number"
        />
      );
    case 'organization':
      return (
        <ReferenceAutocomplete
          label={translate('resources.transactions.fields.organization')}
          onChange={(id) => setField('organization', id)}
          optionText={nameOptionText}
          reference="organizations"
          searchToFilter={nameSearchToFilter}
          sortField="name"
          value={state.organization}
        />
      );
    case 'debit_account':
    case 'credit_account':
      return (
        <ReferenceAutocomplete
          label={translate(`resources.transactions.fields.${filterKey}`)}
          onChange={(id) => setField(filterKey, id)}
          optionText={accountOptionText}
          reference="accounts"
          searchToFilter={accountSearchToFilter}
          sortField="code"
          value={state[filterKey]}
        />
      );
    case 'description':
    case 'vendor':
      return (
        <DebouncedTextField
          label={translate(`resources.transactions.fields.${filterKey}`)}
          onCommit={(value) => setField(filterKey, value.trim() || undefined)}
          value={state[filterKey] ?? ''}
        />
      );
    default:
      return null;
  }
}

function parseAmount(value: string | undefined): number | undefined {
  if (value == null || value.trim() === '') return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function RangeInputs({
  type,
  fromLabel,
  toLabel,
  fromValue,
  toValue,
  onFrom,
  onTo,
}: {
  type: 'date' | 'number';
  fromLabel: string;
  toLabel: string;
  fromValue?: string;
  toValue?: string;
  onFrom: (value: string | undefined) => void;
  onTo: (value: string | undefined) => void;
}) {
  const Field = type === 'number' ? DebouncedTextField : DateField;
  return (
    <Stack spacing={1}>
      <Field
        label={fromLabel}
        onCommit={(value) => onFrom(value || undefined)}
        type={type}
        value={fromValue ?? ''}
      />
      <Field
        label={toLabel}
        onCommit={(value) => onTo(value || undefined)}
        type={type}
        value={toValue ?? ''}
      />
    </Stack>
  );
}

type CommitFieldProps = {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  type?: string;
};

function DateField({ label, value, onCommit }: CommitFieldProps) {
  return (
    <TextField
      fullWidth
      label={label}
      onChange={(event) => onCommit(event.target.value)}
      size="small"
      slotProps={{ inputLabel: { shrink: true } }}
      type="date"
      value={value}
    />
  );
}

/** Local text state; commits to the atom after a pause, on blur or Enter. */
function DebouncedTextField({
  label,
  value,
  onCommit,
  type = 'text',
}: CommitFieldProps) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    if (draft === committed.current) return undefined;
    const timer = window.setTimeout(() => {
      committed.current = draft;
      onCommitRef.current(draft);
    }, TEXT_COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const flush = () => {
    if (draft === committed.current) return;
    committed.current = draft;
    onCommit(draft);
  };

  return (
    <TextField
      fullWidth
      label={label}
      onBlur={flush}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') flush();
      }}
      size="small"
      type={type}
      value={draft}
    />
  );
}

function nameOptionText(record: RaRecord): string {
  return String((record as { name?: string | null }).name ?? '');
}

function accountOptionText(record: RaRecord): string {
  const account = record as { code?: string | null; name?: string | null };
  return [account.code, account.name].filter(Boolean).join(' ');
}

function accountSearchToFilter(searchText: string): Record<string, unknown> {
  const query = searchText.trim();
  if (!query) return {};
  return {
    $or: [{ name: { $containsi: query } }, { code: { $containsi: query } }],
  };
}

function nameSearchToFilter(searchText: string): Record<string, unknown> {
  const query = searchText.trim();
  // Nested operator: ra-strapi 1.0.3 slices the `_containsi` suffix one character short.
  return query ? { name: { $containsi: query } } : {};
}

/** Relation picker without a List context: `useGetList` + MUI Autocomplete. */
function ReferenceAutocomplete({
  reference,
  label,
  value,
  onChange,
  optionText,
  searchToFilter,
  sortField,
}: {
  reference: string;
  label: string;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  optionText: (record: RaRecord) => string;
  searchToFilter: (search: string) => Record<string, unknown>;
  sortField: string;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search),
      TEXT_COMMIT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data: options = [], isPending } = useGetList(reference, {
    filter: searchToFilter(debouncedSearch),
    pagination: { page: 1, perPage: 100 },
    sort: { field: sortField, order: 'ASC' },
  });
  const { data: selected } = useGetOne(
    reference,
    { id: value ?? '' },
    { enabled: Boolean(value) },
  );

  const allOptions = useMemo(() => {
    if (!selected || options.some((row) => row.id === selected.id)) {
      return options;
    }
    return [selected, ...options];
  }, [options, selected]);

  const current = value
    ? (allOptions.find((row) => String(row.id) === value) ?? null)
    : null;

  return (
    <Autocomplete<RaRecord>
      filterOptions={(items) => items}
      getOptionLabel={optionText}
      isOptionEqualToValue={(left, right) => left.id === right.id}
      loading={isPending}
      onChange={(_e, record) =>
        onChange(record ? String(record.id) : undefined)
      }
      onInputChange={(_e, text, reason) => {
        if (reason === 'input') setSearch(text);
        if (reason === 'clear' || reason === 'reset') setSearch('');
      }}
      options={allOptions}
      renderInput={(params) => (
        <TextField {...params} label={label} size="small" />
      )}
      size="small"
      value={current}
    />
  );
}
