import GradingIcon from '@mui/icons-material/Grading';
import QuizIcon from '@mui/icons-material/Quiz';
import { Box, Button, Typography } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import {
  AutocompleteInput,
  Datagrid,
  DateInput,
  FilterButton,
  FunctionField,
  List,
  NumberField,
  NumberInput,
  ReferenceInput,
  SelectArrayInput,
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

import { isEditorLike } from '../../auth/roles';
import { receiptCount } from '../../data/receiptDraft';
import {
  CONVERTED_EXPANDED,
  CONVERTED_FILTER_NONE,
  CONVERTED_ORIGINAL,
  CONVERTED_STORNO,
  DEFAULT_CONVERTED_FILTER,
  firstReceiptVendor,
  sumTransactionAmountsByCurrency,
} from '../../data/transactionList';
import {
  defaultTransactionDisplayedFilters,
  defaultTransactionListFilter,
} from '../../data/transactionListLocation';
import { bandedRow } from '../../theme';
import { AccountFieldLabel, AccountValue } from './accountField';
import { CurrencyValue } from './currencyField';
import { TransactionDateValue } from './dateField';
import { DescriptionText } from './DescriptionText';
import { TransactionBulkApproveButton } from './TransactionBulkApproveButton';
import { TransactionConvertField } from './TransactionConvertField';

const statusChoices = [
  { id: 'draft', name: 'app.status.draft' },
  { id: 'published', name: 'app.status.published' },
];

const convertedChoices = [
  { id: CONVERTED_FILTER_NONE, name: 'app.converted.none' },
  { id: CONVERTED_EXPANDED, name: 'app.converted.expanded' },
  { id: CONVERTED_STORNO, name: 'app.converted.storno' },
  { id: CONVERTED_ORIGINAL, name: 'app.converted.original' },
];

const convertedFieldChoices = [
  { id: CONVERTED_EXPANDED, name: 'app.converted.expanded' },
  { id: CONVERTED_STORNO, name: 'app.converted.storno' },
  { id: CONVERTED_ORIGINAL, name: 'app.converted.original' },
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
  <SelectArrayInput
    alwaysOn
    choices={convertedChoices}
    key="converted_to_workflow"
    label="resources.transactions.fields.converted_to_workflow"
    source="converted_to_workflow"
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
    label={<AccountFieldLabel kind="debit" />}
    perPage={100}
    reference="accounts"
    sort={{ field: 'code', order: 'ASC' }}
    source="debit_account"
  >
    <AutocompleteInput
      filterToQuery={accountFilterToQuery}
      label={<AccountFieldLabel kind="debit" />}
      optionText={accountOptionText}
    />
  </ReferenceInput>,
  <ReferenceInput
    key="credit_account"
    label={<AccountFieldLabel kind="credit" />}
    perPage={100}
    reference="accounts"
    sort={{ field: 'code', order: 'ASC' }}
    source="credit_account"
  >
    <AutocompleteInput
      filterToQuery={accountFilterToQuery}
      label={<AccountFieldLabel kind="credit" />}
      optionText={accountOptionText}
    />
  </ReferenceInput>,
  <TextInput key="description" source="description" />,
  <TextInput key="vendor" source="vendor" />,
];

function relationName(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const name = (value as { name?: string | null }).name;
  return name || '—';
}

function ClearFiltersButton() {
  const translate = useTranslate();
  const { setFilters } = useListContext();
  return (
    <Button
      size="small"
      variant="outlined"
      onClick={() =>
        setFilters(
          defaultTransactionListFilter('all'),
          defaultTransactionDisplayedFilters('all'),
        )
      }
    >
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
  const review = isEditorLike(permissions) && record.status === 'draft';
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
      state={{ _scrollToTop: true }}
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

function formatPageAmountTotal(
  amount: number,
  currency: string,
  locale: string,
): string {
  const tag = locale === 'en' ? 'en' : 'hu-HU';
  if (currency === '—') {
    return new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }).format(
      amount,
    );
  }
  try {
    return new Intl.NumberFormat(tag, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'HUF' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat(tag).format(amount)} ${currency}`;
  }
}

/** Grid tracks aligned with Datagrid columns up to `amount` (then a flexible tail). */
function transactionListFooterGridColumns(
  mobile: boolean,
  showBulkCheckbox: boolean,
): string {
  if (mobile) {
    return showBulkCheckbox
      ? '3rem 6.25rem 6.25rem 4.25rem 4.75rem 5.25rem 7.25rem minmax(5rem, 1fr)'
      : '6.25rem 6.25rem 4.25rem 4.75rem 5.25rem 7.25rem minmax(5rem, 1fr)';
  }
  return showBulkCheckbox
    ? '3rem 4.25rem 4.75rem 5.25rem 7.25rem minmax(5rem, 1fr)'
    : '4.25rem 4.75rem 5.25rem 7.25rem minmax(5rem, 1fr)';
}

function transactionListFooterMinWidth(
  mobile: boolean,
  showBulkCheckbox: boolean,
): number | string {
  return mobile ? (showBulkCheckbox ? '44rem' : '41rem') : '52rem';
}

function TransactionListAmountFooter({
  locale,
  mobile,
  showBulkCheckbox,
}: {
  locale: string;
  mobile: boolean;
  showBulkCheckbox: boolean;
}) {
  const translate = useTranslate();
  const { data, isPending, total } = useListContext();
  const rows = data ?? [];
  const totals = sumTransactionAmountsByCurrency(rows);
  if (isPending || rows.length === 0 || totals.length === 0) {
    return null;
  }

  const formatted = totals
    .map((row) => formatPageAmountTotal(row.amount, row.currency, locale))
    .join('  |  ');

  const gridColumns = transactionListFooterGridColumns(
    mobile,
    showBulkCheckbox,
  );

  return (
    <Box
      sx={{
        bgcolor: 'action.hover',
        borderTop: 1,
        borderColor: 'divider',
        columnGap: 0,
        display: 'grid',
        gridTemplateColumns: gridColumns,
        alignItems: 'center',
        minHeight: 40,
        minWidth: transactionListFooterMinWidth(mobile, showBulkCheckbox),
        py: 0.75,
        typography: 'body2',
        width: 'max-content',
      }}
    >
      {showBulkCheckbox ? <Box aria-hidden /> : null}
      {mobile ? (
        <>
          <Box aria-hidden />
          <Box aria-hidden />
        </>
      ) : null}
      <Box
        sx={{
          fontWeight: 600,
          gridColumn: mobile ? 'span 3' : 'span 3',
          minWidth: 0,
          overflow: 'hidden',
          pl: showBulkCheckbox ? 0.5 : 1,
          pr: 0.5,
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {translate('app.transactions_page_total')}
        {total != null ? (
          <Typography
            color="text.secondary"
            component="span"
            sx={{ fontWeight: 400, ml: 0.75 }}
            variant="inherit"
          >
            ({rows.length} / {total})
          </Typography>
        ) : null}
      </Box>
      <Box
        className="column-amount"
        sx={{
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          pr: 1,
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        {formatted}
      </Box>
      <Box aria-hidden sx={{ minWidth: 48 }} />
    </Box>
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

function transactionDatagridColumns(locale: string, mobile: boolean) {
  const openColumn = (
    <TransactionOpenField
      key="open"
      label={false}
      sortable={false}
      source="open"
    />
  );
  const convertColumn = (
    <TransactionConvertField
      key="convert"
      label={false}
      sortable={false}
      source="convert"
    />
  );

  const columns = [
    <NumberField key="entryId" source="entryId" />,
    <FunctionField
      key="date"
      render={(record: RaRecord) => (
        <TransactionDateValue locale={locale} value={record.date} />
      )}
      source="date"
    />,
    <FunctionField
      key="vendor"
      render={(record: RaRecord) => firstReceiptVendor(record.receipts)}
      source="vendor"
    />,
    <NumberField
      key="amount"
      locales={locale === 'en' ? 'en' : 'hu-HU'}
      source="amount"
    />,
    <FunctionField
      key="currency"
      render={(record: RaRecord) => (
        <CurrencyValue value={record.currency_type} />
      )}
      source="currency_type"
    />,
    <FunctionField
      key="description"
      render={(record: RaRecord) => (
        <DescriptionText value={record.description} />
      )}
      source="description"
    />,
    <SelectField
      key="status"
      choices={statusChoices}
      source="status"
      translateChoice
    />,
    <SelectField
      key="converted_to_workflow"
      choices={convertedFieldChoices}
      emptyText="app.converted.none"
      source="converted_to_workflow"
      translateChoice
    />,
    openColumn,
    convertColumn,
    <FunctionField
      key="organization"
      render={(record: RaRecord) => relationName(record.organization)}
      source="organization"
    />,
    <FunctionField
      key="credit"
      label={<AccountFieldLabel kind="credit" />}
      render={(record: RaRecord) => (
        <AccountValue kind="credit" value={record.credit_account} />
      )}
      source="credit_account"
    />,
    <FunctionField
      key="debit"
      label={<AccountFieldLabel kind="debit" />}
      render={(record: RaRecord) => (
        <AccountValue kind="debit" value={record.debit_account} />
      )}
      source="debit_account"
    />,
    <FunctionField
      key="receipts"
      label="resources.transactions.fields.receipt"
      render={(record: RaRecord) => receiptCount(record.receipts)}
      sortBy="receipts"
      source="receipts"
    />,
    <FunctionField
      key="createdAt"
      render={(record: RaRecord) => (
        <TransactionDateValue
          locale={locale}
          showTime
          value={record.createdAt}
        />
      )}
      source="createdAt"
    />,
    <TextField key="entered_by" emptyText="—" source="entered_by" />,
    <TextField key="published_by" emptyText="—" source="published_by" />,
    <FunctionField
      key="publishedAt"
      render={(record: RaRecord) => (
        <TransactionDateValue
          emptyText="—"
          locale={locale}
          showTime
          value={record.publishedAt}
        />
      )}
      source="publishedAt"
    />,
  ];

  if (mobile) {
    const withoutRowActions = columns.filter(
      (column) => column.key !== 'open' && column.key !== 'convert',
    );
    return [openColumn, convertColumn, ...withoutRowActions];
  }

  return columns;
}

function draftRowSelectable(record: RaRecord & { status?: string }) {
  return record.status === 'draft';
}

export function TransactionList() {
  const [locale] = useLocaleState();
  const mobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const { permissions, isPending } = usePermissions();
  const editorBulkApprove = !isPending && isEditorLike(permissions);

  return (
    <List
      actions={<TransactionListActions />}
      empty={false}
      exporter={false}
      filterDefaultValues={{
        converted_to_workflow: [...DEFAULT_CONVERTED_FILTER],
      }}
      filters={transactionFilters}
      perPage={25}
      sort={{ field: 'entryId', order: 'DESC' }}
    >
      <Box
        sx={{
          maxWidth: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <Datagrid
          bulkActionButtons={
            editorBulkApprove ? <TransactionBulkApproveButton /> : false
          }
          empty={<TransactionListEmpty />}
          hover={false}
          isRowSelectable={editorBulkApprove ? draftRowSelectable : undefined}
          rowClick={false}
          rowSx={bandedRow}
          sx={{
            '& .RaDatagrid-table, & table': {
              mb: 0,
              minWidth: transactionListFooterMinWidth(
                mobile,
                editorBulkApprove,
              ),
            },
            '& .column-open, & .column-convert': {
              whiteSpace: 'nowrap',
            },
          }}
        >
          {transactionDatagridColumns(locale, mobile)}
        </Datagrid>
        <TransactionListAmountFooter
          locale={locale}
          mobile={mobile}
          showBulkCheckbox={editorBulkApprove}
        />
      </Box>
    </List>
  );
}
