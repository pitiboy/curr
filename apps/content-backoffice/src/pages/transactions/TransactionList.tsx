import GradingIcon from '@mui/icons-material/Grading';
import QuizIcon from '@mui/icons-material/Quiz';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import { useCallback } from 'react';
import {
  Datagrid,
  FunctionField,
  List,
  NumberField,
  SelectField,
  TextField,
  useListContext,
  useLocaleState,
  usePermissions,
  useRecordContext,
  useTranslate,
  Link,
  type RaRecord,
} from 'react-admin';

import { isEditorLikeRole } from '../../auth/roles';
import { receiptCount } from '../../data/receiptDraft';
import {
  CONVERTED_EXPANDED,
  CONVERTED_ORIGINAL,
  CONVERTED_STORNO,
  firstReceiptVendor,
  sumTransactionAmountsByCurrency,
  type TransactionRow,
} from '../../data/transactionList';
import { TransactionListFilterBridge } from '../../filters/TransactionListFilterBridge';
import { bandedRow } from '../../theme';
import { AccountFieldLabel, AccountValue } from './accountField';
import { CurrencyValue } from './currencyField';
import { TransactionDateValue } from './dateField';
import { DescriptionText } from './DescriptionText';
import { TransactionBulkApproveButton } from './TransactionBulkApproveButton';
import { TransactionBulkConvertButton } from './TransactionBulkConvertButton';
import { isBulkActionSelectable } from '../../data/transactionBulkConvert';
import { useTransactionWorkflowCatalog } from '../../workflows/useTransactionWorkflowCatalog';
import { TransactionConvertField } from './TransactionConvertField';
import {
  TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS,
  transactionListFooterMinWidth,
} from './transactionListLayout';

const statusChoices = [
  { id: 'draft', name: 'app.status.draft' },
  { id: 'published', name: 'app.status.published' },
];

const convertedFieldChoices = [
  { id: CONVERTED_EXPANDED, name: 'app.converted.expanded' },
  { id: CONVERTED_STORNO, name: 'app.converted.storno' },
  { id: CONVERTED_ORIGINAL, name: 'app.converted.original' },
];

function relationName(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const name = (value as { name?: string | null }).name;
  return name || '—';
}

function TransactionOpenField(
  _props: {
    label?: false;
    sortable?: false;
    source?: string;
    compact?: boolean;
  } = {},
) {
  const { compact = false } = _props;
  const record = useRecordContext<RaRecord & { status?: string }>();
  const { permissions, isPending } = usePermissions();
  const translate = useTranslate();
  if (!record || isPending) return null;
  const review = isEditorLikeRole(permissions) && record.status === 'draft';
  const labelKey = review ? 'app.transactions_review' : 'app.transactions_show';
  const label = translate(labelKey);
  const to = `/transactions/${encodeURIComponent(String(record.id))}/show`;
  const reviewSx = review
    ? {
        bgcolor: '#FFF4C2',
        '&:hover': { bgcolor: '#FFE99A' },
      }
    : undefined;

  if (compact) {
    return (
      <Tooltip title={label}>
        <IconButton
          aria-label={label}
          color={review ? 'warning' : 'default'}
          component={Link}
          size="small"
          state={{ _scrollToTop: true }}
          sx={reviewSx}
          to={to}
          onClick={(event: React.MouseEvent<HTMLButtonElement>) =>
            event.stopPropagation()
          }
        >
          {review ? (
            <QuizIcon color="warning" fontSize="small" />
          ) : (
            <GradingIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Button
      component={Link}
      size="small"
      startIcon={review ? <QuizIcon color="warning" /> : <GradingIcon />}
      sx={reviewSx}
      state={{ _scrollToTop: true }}
      to={to}
      variant="outlined"
      onClick={(event: React.MouseEvent<HTMLButtonElement>) =>
        event.stopPropagation()
      }
    >
      {label}
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
function transactionListFooterGridColumns(showBulkCheckbox: boolean): string {
  return showBulkCheckbox
    ? '3rem 4.25rem 4.75rem 5.25rem 7.25rem minmax(5rem, 1fr)'
    : '4.25rem 4.75rem 5.25rem 7.25rem minmax(5rem, 1fr)';
}

function TransactionListAmountFooter({
  locale,
  showBulkCheckbox,
}: {
  locale: string;
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

  return (
    <Box
      sx={{
        bgcolor: 'action.hover',
        borderTop: 1,
        borderColor: 'divider',
        columnGap: 0,
        display: 'grid',
        gridTemplateColumns: transactionListFooterGridColumns(showBulkCheckbox),
        alignItems: 'center',
        minHeight: 40,
        minWidth: transactionListFooterMinWidth(false, showBulkCheckbox),
        py: 0.75,
        typography: 'body2',
        width: 'max-content',
      }}
    >
      {showBulkCheckbox ? <Box aria-hidden /> : null}
      <Box
        sx={{
          fontWeight: 600,
          gridColumn: 'span 3',
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
    <TransactionOpenField
      key="open"
      compact={mobile}
      label={false}
      sortable={false}
      source="open"
    />,
    <TransactionConvertField
      key="convert"
      compact={mobile}
      label={false}
      sortable={false}
      source="convert"
    />,
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

  if (!mobile) return columns;

  const hiddenOnMobile = new Set(TRANSACTION_LIST_MOBILE_HIDDEN_COLUMN_KEYS);
  if (hiddenOnMobile.size === 0) return columns;

  return columns.filter(
    (column) => column.key == null || !hiddenOnMobile.has(String(column.key)),
  );
}

export function TransactionList() {
  const [locale] = useLocaleState();
  const mobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const { permissions, isPending } = usePermissions();
  const editorBulkApprove = !isPending && isEditorLikeRole(permissions);
  const { workflows } = useTransactionWorkflowCatalog();
  const isRowSelectable = useCallback(
    (record: RaRecord) =>
      isBulkActionSelectable(record as TransactionRow, workflows),
    [workflows],
  );

  return (
    <List
      actions={false}
      empty={false}
      exporter={false}
      perPage={25}
      // Atom (sidebar) owns filters. RA's default `transactions.listParams`
      // store otherwise restores stale filters when the URL has no `?filter=`
      // (menu navigate) — sidebar and list desync (reset / ügylet bontás).
      storeKey={false}
      sort={{ field: 'entryId', order: 'DESC' }}
    >
      {/* Filters come from the global sidebar panel (Jotai atom). */}
      <TransactionListFilterBridge />
      <Box
        sx={{
          maxWidth: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <Datagrid
          bulkActionButtons={
            editorBulkApprove ? (
              <>
                <TransactionBulkApproveButton />
                <TransactionBulkConvertButton />
              </>
            ) : (
              false
            )
          }
          empty={<TransactionListEmpty />}
          hover={false}
          isRowSelectable={editorBulkApprove ? isRowSelectable : undefined}
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
              px: mobile ? 0.25 : undefined,
              whiteSpace: 'nowrap',
              width: mobile ? '1%' : undefined,
            },
            ...(mobile
              ? {
                  '& .RaDatagrid-rowCell': {
                    fontSize: '0.8125rem',
                    px: 0.5,
                    py: 0.75,
                  },
                  '& .RaDatagrid-headerCell': {
                    fontSize: '0.75rem',
                    px: 0.5,
                    py: 0.5,
                  },
                  '& .column-description': {
                    maxWidth: '10rem',
                  },
                }
              : {}),
          }}
        >
          {transactionDatagridColumns(locale, mobile)}
        </Datagrid>
        <TransactionListAmountFooter
          locale={locale}
          showBulkCheckbox={editorBulkApprove}
        />
      </Box>
    </List>
  );
}
