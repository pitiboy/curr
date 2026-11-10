import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import { Link, useGetOne, useTranslate, type RaRecord } from 'react-admin';

import { AccountValue } from './accountField';
import { DescriptionText } from './DescriptionText';
import { TransactionDateValue } from './dateField';
import {
  convertedLabelKey,
  needsParentFetch,
  parentDocumentId,
  relatedItemsFromRecord,
  type RelatedTransactionItem,
} from './relatedTransactions';

type RelatedTransactionsSectionProps = {
  locale: string;
  locales: string;
  record: RaRecord;
};

export function RelatedTransactionsSection({
  locale,
  locales,
  record,
}: RelatedTransactionsSectionProps) {
  const translate = useTranslate();
  const parentId = parentDocumentId(record);
  const fetchParent = needsParentFetch(record);
  const { data: parentRecord, isPending } = useGetOne(
    'transactions',
    { id: parentId ?? '' },
    { enabled: fetchParent && Boolean(parentId) },
  );

  if (fetchParent && isPending) {
    return (
      <Typography color="text.secondary" variant="body2">
        {translate('ra.page.loading')}
      </Typography>
    );
  }

  const items = relatedItemsFromRecord(
    record,
    fetchParent ? parentRecord : null,
  );
  if (items.length === 0) {
    return <>—</>;
  }

  const currentId = String(record.id);

  return (
    <Box sx={{ maxWidth: '100%', minWidth: 0, overflowX: 'auto' }}>
      <Table padding="none" size="small" sx={{ minWidth: 540 }}>
        <TableBody>
          {items.map((item) => (
            <RelatedTransactionRow
              currentId={currentId}
              item={item}
              key={item.documentId}
              locale={locale}
              locales={locales}
            />
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function RelatedTransactionRow({
  currentId,
  item,
  locale,
  locales,
}: {
  currentId: string;
  item: RelatedTransactionItem;
  locale: string;
  locales: string;
}) {
  const translate = useTranslate();
  const isCurrent = item.documentId === currentId;
  const convertedKey = convertedLabelKey(item.converted_to_workflow);
  const currency =
    item.currency_type?.code?.trim() || item.currency_type?.name?.trim() || '';

  return (
    <TableRow
      selected={isCurrent}
      sx={{
        '&:last-child td': { borderBottom: 0 },
        ...(isCurrent
          ? { bgcolor: (theme) => theme.palette.action.selected }
          : {}),
      }}
    >
      <TableCell
        align="right"
        sx={{ pr: 1, verticalAlign: 'top', whiteSpace: 'nowrap' }}
      >
        <Typography component="span" variant="body2">
          {item.entryId ?? '—'}
        </Typography>
      </TableCell>
      <TableCell sx={{ pr: 1, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
        <TransactionDateValue locale={locale} value={item.date} />
      </TableCell>
      <TableCell align="right" sx={{ pr: 1, verticalAlign: 'top' }}>
        <Typography component="span" variant="body2">
          {formatAmount(item.amount, locales)}
          {currency ? ` ${currency}` : ''}
        </Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <DescriptionText value={item.description} />
        {convertedKey ? (
          <Typography color="text.secondary" component="div" variant="caption">
            {translate(convertedKey)}
            {isCurrent
              ? ` · ${translate('app.transactions_related_current')}`
              : ''}
          </Typography>
        ) : isCurrent ? (
          <Typography color="text.secondary" component="div" variant="caption">
            {translate('app.transactions_related_current')}
          </Typography>
        ) : null}
      </TableCell>
      <TableCell sx={{ pr: 1, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
        <AccountValue kind="credit" value={item.credit_account} />
      </TableCell>
      <TableCell sx={{ pr: 1, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
        <AccountValue kind="debit" value={item.debit_account} />
      </TableCell>
      <TableCell align="right" sx={{ pl: 1, verticalAlign: 'top' }}>
        {isCurrent ? (
          <Typography color="text.secondary" variant="body2">
            —
          </Typography>
        ) : (
          <Button
            component={Link}
            size="small"
            state={{ _scrollToTop: true }}
            to={`/transactions/${encodeURIComponent(item.documentId)}/show`}
            variant="text"
          >
            {translate('app.transactions_show')}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function formatAmount(value: unknown, locales: string): string {
  if (value === null || value === undefined || value === '') return '—';
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat(locales).format(amount);
}
