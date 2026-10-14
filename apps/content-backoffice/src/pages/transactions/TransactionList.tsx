import { Box, Typography } from '@mui/material';
import {
  AutocompleteInput,
  Datagrid,
  DateField,
  DateInput,
  FunctionField,
  List,
  NumberField,
  NumberInput,
  ReferenceInput,
  SelectField,
  SelectInput,
  TextField,
  TextInput,
  useLocaleState,
  useTranslate,
  type RaRecord,
} from 'react-admin';

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
  <NumberInput key="amount" source="amount" />,
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
  const translate = useTranslate();
  const [locale] = useLocaleState();

  return (
    <List
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
      >
        <DateField source="date" />
        <NumberField
          locales={locale === 'en' ? 'en' : 'hu-HU'}
          source="amount"
        />
        <TextField emptyText="—" source="description" />
        <FunctionField
          render={(record: RaRecord) => relationName(record.organization)}
          source="organization"
        />
        <FunctionField
          render={(record: RaRecord) => accountLabel(record.debit_account)}
          source="debit_account"
        />
        <FunctionField
          render={(record: RaRecord) => accountLabel(record.credit_account)}
          source="credit_account"
        />
        <SelectField choices={statusChoices} source="status" translateChoice />
        <FunctionField
          render={(record: RaRecord) =>
            record.receipt
              ? translate('app.receipt_yes')
              : translate('app.receipt_no')
          }
          source="receipt"
        />
      </Datagrid>
    </List>
  );
}
