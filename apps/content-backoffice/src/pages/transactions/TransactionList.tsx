import GradingIcon from '@mui/icons-material/Grading';
import QuizIcon from '@mui/icons-material/Quiz';
import { Box, Button, Typography } from '@mui/material';
import {
  AutocompleteInput,
  Datagrid,
  DateField,
  DateInput,
  FilterButton,
  FunctionField,
  List,
  NumberField,
  NumberInput,
  ReferenceInput,
  SelectField,
  SelectInput,
  TextField,
  TextInput,
  TopToolbar,
  useListContext,
  useLocaleState,
  usePermissions,
  useRecordContext,
  useTranslate,
  Link,
  type RaRecord,
} from 'react-admin';

import { receiptCount } from '../../data/receiptDraft';
import { bandedRow } from '../../theme';
import { dateFieldProps } from './dateField';

const statusChoices = [
  { id: 'draft', name: 'app.status.draft' },
  { id: 'published', name: 'app.status.published' },
];

function accountOptionText(record: RaRecord): string {
  const account = record as { code?: string | null; name?: string | null };
  return [account.code, account.name].filter(Boolean).join(' ');
}

function accountFilterToQuery(searchText: string) {
  const query = searchText.trim();
  if (!query) return {};
  return {
    $or: [{ name: { $containsi: query } }, { code: { $containsi: query } }],
  };
}

function nameFilterToQuery(searchText: string) {
  const query = searchText.trim();
  // Nested operator: ra-strapi 1.0.3 slices the `_containsi` suffix one character short.
  return query ? { name: { $containsi: query } } : {};
}

const transactionFilters = [
  <SelectInput
    alwaysOn
    choices={statusChoices}
    emptyText="app.filters.status_all"
    key="status"
    label="resources.transactions.fields.status"
    source="status"
    translateChoice
  />,
  <DateInput key="date_gte" label="app.filters.date_from" source="date_gte" />,
  <DateInput key="date_lte" label="app.filters.date_to" source="date_lte" />,
  <DateInput
    key="createdAt_gte"
    label="app.filters.created_from"
    source="createdAt_gte"
  />,
  <DateInput
    key="createdAt_lte"
    label="app.filters.created_to"
    source="createdAt_lte"
  />,
  <NumberInput
    key="amount_gte"
    label="app.filters.amount_from"
    source="amount_gte"
  />,
  <NumberInput
    key="amount_lte"
    label="app.filters.amount_to"
    source="amount_lte"
  />,
  <ReferenceInput
    key="organization"
    perPage={100}
    reference="organizations"
    sort={{ field: 'name', order: 'ASC' }}
    source="organization"
  >
    <AutocompleteInput filterToQuery={nameFilterToQuery} optionText="name" />
  </ReferenceInput>,
  <ReferenceInput
    key="debit_account"
    perPage={100}
    reference="accounts"
    sort={{ field: 'code', order: 'ASC' }}
    source="debit_account"
  >
    <AutocompleteInput
      filterToQuery={accountFilterToQuery}
      optionText={accountOptionText}
    />
  </ReferenceInput>,
  <ReferenceInput
    key="credit_account"
    perPage={100}
    reference="accounts"
    sort={{ field: 'code', order: 'ASC' }}
    source="credit_account"
  >
    <AutocompleteInput
      filterToQuery={accountFilterToQuery}
      optionText={accountOptionText}
    />
  </ReferenceInput>,
  <TextInput key="description" source="description" />,
];

function relationName(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const name = (value as { name?: string | null }).name;
  return name || '—';
}

function accountLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const account = value as { code?: string | null; name?: string | null };
  const label = [account.code, account.name].filter(Boolean).join(' ');
  return label || '—';
}

function currencyLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const currency = value as { code?: string | null; name?: string | null };
  const label = [currency.code, currency.name].filter(Boolean).join(' ');
  return label || '—';
}

function ClearFiltersButton() {
  const translate = useTranslate();
  const { setFilters } = useListContext();
  return (
    <Button size="small" variant="outlined" onClick={() => setFilters({}, {})}>
      {translate('app.filters.clear')}
    </Button>
  );
}

function TransactionListActions() {
  return (
    <TopToolbar>
      <ClearFiltersButton />
      <FilterButton />
    </TopToolbar>
  );
}

function TransactionOpenField(_props: {
  label?: false;
  sortable?: false;
  source?: string;
}) {
  const record = useRecordContext<RaRecord & { status?: string }>();
  const { permissions, isPending } = usePermissions();
  const translate = useTranslate();
  if (!record || isPending) return null;
  const review = permissions === 'editor' && record.status === 'draft';
  return (
    <Button
      component={Link}
      size="small"
      startIcon={review ? <QuizIcon color="warning" /> : <GradingIcon />}
      sx={
        review
          ? {
              bgcolor: '#FFF4C2',
              '&:hover': { bgcolor: '#FFE99A' },
            }
          : undefined
      }
      to={`/transactions/${encodeURIComponent(String(record.id))}/show`}
      variant="outlined"
      onClick={(event: React.MouseEvent<HTMLButtonElement>) =>
        event.stopPropagation()
      }
    >
      {translate(review ? 'app.transactions_review' : 'app.transactions_show')}
    </Button>
  );
}

function TransactionListEmpty() {
  const translate = useTranslate();
  return (
    <Box sx={{ p: 2 }}>
      <Typography color="text.secondary" variant="body1">
        {translate('app.transactions_none')}
      </Typography>
    </Box>
  );
}

export function TransactionList() {
  const [locale] = useLocaleState();

  return (
    <List
      actions={<TransactionListActions />}
      empty={false}
      exporter={false}
      filters={transactionFilters}
      perPage={25}
      sort={{ field: 'date', order: 'DESC' }}
    >
      <Datagrid
        bulkActionButtons={false}
        empty={<TransactionListEmpty />}
        hover={false}
        rowClick={false}
        rowSx={bandedRow}
      >
        <DateField source="date" {...dateFieldProps(locale)} />
        <NumberField
          locales={locale === 'en' ? 'en' : 'hu-HU'}
          source="amount"
        />
        <FunctionField
          render={(record: RaRecord) => currencyLabel(record.currency_type)}
          source="currency_type"
        />
        <TextField emptyText="—" source="description" />
        <SelectField choices={statusChoices} source="status" translateChoice />
        <TransactionOpenField label={false} sortable={false} source="open" />
        <FunctionField
          render={(record: RaRecord) => relationName(record.organization)}
          source="organization"
        />
        <FunctionField
          render={(record: RaRecord) => accountLabel(record.credit_account)}
          source="credit_account"
        />
        <FunctionField
          render={(record: RaRecord) => accountLabel(record.debit_account)}
          source="debit_account"
        />
        <FunctionField
          label="resources.transactions.fields.receipt"
          render={(record: RaRecord) => receiptCount(record.receipts)}
          sortBy="receipts"
          source="receipts"
        />
        <DateField source="createdAt" {...dateFieldProps(locale, true)} />
        <TextField emptyText="—" source="entered_by" />
        <TextField emptyText="—" source="published_by" />
        <DateField
          emptyText="—"
          source="publishedAt"
          {...dateFieldProps(locale, true)}
        />
      </Datagrid>
    </List>
  );
}
