import {
  Alert,
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import {
  Confirm,
  Link,
  useGetOne,
  useNotify,
  usePermissions,
  useRedirect,
  useRefresh,
  useTranslate,
  type RaRecord,
} from 'react-admin';

import { canPurgeExpansion } from '../../auth/roles';
import { deleteTransaction, purgeExpansion } from '../../data/dataProvider';
import { strapiErrorMessage } from '../../data/transactionPublish';
import { AccountValue } from './accountField';
import { DescriptionText } from './DescriptionText';
import { TransactionDateValue } from './dateField';
import {
  canDeleteRelatedRow,
  convertedLabelKey,
  expansionDocumentIds,
  needsParentFetch,
  parentDocumentId,
  purgeExpansionTarget,
  relatedItemsFromRecord,
  type RelatedTransactionItem,
} from './relatedTransactions';

type RelatedTransactionsSectionProps = {
  locale: string;
  locales: string;
  record: RaRecord;
};

type PendingDelete =
  | { kind: 'row'; documentId: string }
  | { kind: 'purge'; originalDocumentId: string; removed: string[] };

export function RelatedTransactionsSection({
  locale,
  locales,
  record,
}: RelatedTransactionsSectionProps) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const { permissions, isPending: permissionsPending } = usePermissions();
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
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
  const canDelete = !permissionsPending && canPurgeExpansion(permissions);
  const purgeTarget = canDelete ? purgeExpansionTarget(items, record) : null;
  const published = record.status === 'published';

  const onConfirm = () => {
    if (!pending || deleting) return;
    setDeleting(true);
    const run =
      pending.kind === 'row'
        ? deleteTransaction(pending.documentId)
        : purgeExpansion(pending.originalDocumentId);
    const doneKey =
      pending.kind === 'row'
        ? 'app.transactions_delete_row_done'
        : 'app.transactions_purge_expansion_done';
    const errorKey =
      pending.kind === 'row'
        ? 'app.transactions_delete_row_error'
        : 'app.transactions_purge_expansion_error';
    void run
      .then(() => {
        notify(doneKey, { type: 'success' });
        const target = pending;
        setPending(null);
        if (target.kind === 'row' && target.documentId === currentId) {
          redirect('list', 'transactions');
        } else if (
          target.kind === 'purge' &&
          target.removed.includes(currentId)
        ) {
          redirect('show', 'transactions', target.originalDocumentId);
        } else {
          refresh();
        }
      })
      .catch((error: unknown) => {
        const message = strapiErrorMessage(error);
        notify(message || errorKey, { type: 'error' });
      })
      .finally(() => setDeleting(false));
  };

  const confirmBody =
    pending?.kind === 'purge'
      ? 'app.transactions_purge_expansion_body'
      : 'app.transactions_delete_row_body';

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
              onDelete={
                canDelete && canDeleteRelatedRow(item)
                  ? () =>
                      setPending({ kind: 'row', documentId: item.documentId })
                  : undefined
              }
            />
          ))}
        </TableBody>
      </Table>
      {purgeTarget ? (
        <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 1 }}>
          <Button
            color="error"
            onClick={() =>
              setPending({
                kind: 'purge',
                originalDocumentId: purgeTarget,
                removed: expansionDocumentIds(items),
              })
            }
            size="small"
            variant="outlined"
          >
            {translate('app.transactions_purge_expansion')}
          </Button>
        </Stack>
      ) : null}
      <Confirm
        cancel="ra.action.cancel"
        confirm="app.transactions_discard_confirm"
        confirmColor="warning"
        content={
          <Stack spacing={1}>
            {published ? (
              <Alert severity="warning">
                {translate('app.transactions_delete_published_warning')}
              </Alert>
            ) : null}
            <Typography variant="body2">{translate(confirmBody)}</Typography>
          </Stack>
        }
        isOpen={pending != null}
        loading={deleting}
        onClose={() => {
          if (!deleting) setPending(null);
        }}
        onConfirm={onConfirm}
        title={
          pending?.kind === 'purge'
            ? 'app.transactions_purge_expansion_title'
            : 'app.transactions_delete_row_title'
        }
      />
    </Box>
  );
}

function RelatedTransactionRow({
  currentId,
  item,
  locale,
  locales,
  onDelete,
}: {
  currentId: string;
  item: RelatedTransactionItem;
  locale: string;
  locales: string;
  onDelete?: () => void;
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
      <TableCell
        align="right"
        sx={{ pl: 1, verticalAlign: 'top', whiteSpace: 'nowrap' }}
      >
        {isCurrent ? (
          <Typography color="text.secondary" component="span" variant="body2">
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
        {onDelete ? (
          <Button
            aria-label={`${translate('app.transactions_delete_row')} ${item.entryId ?? item.documentId}`}
            color="error"
            onClick={onDelete}
            size="small"
            variant="text"
          >
            {translate('app.transactions_delete_row')}
          </Button>
        ) : null}
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
