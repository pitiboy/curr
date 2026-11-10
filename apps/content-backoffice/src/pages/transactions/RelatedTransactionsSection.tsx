import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tooltip,
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
import { CONVERTED_EXPANDED } from '../../data/transactionList';
import { deleteTransaction, purgeExpansion } from '../../data/dataProvider';
import { strapiErrorMessage } from '../../data/transactionPublish';
import { AccountValue } from './accountField';
import { DescriptionText } from './DescriptionText';
import { TransactionDateValue } from './dateField';
import {
  convertedLabelKey,
  needsParentFetch,
  parentDocumentId,
  purgeExpansionPlan,
  relatedItemsFromRecord,
  relatedRowDeleteState,
  type RelatedRowDeleteState,
  type RelatedTransactionItem,
} from './relatedTransactions';

type RelatedTransactionsSectionProps = {
  locale: string;
  locales: string;
  record: RaRecord;
};

type PendingDelete =
  | { kind: 'row'; item: RelatedTransactionItem }
  | {
      kind: 'purge';
      parentDocumentId: string;
      isOriginal: boolean;
      rows: RelatedTransactionItem[];
    };

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
  const purgePlan = canDelete ? purgeExpansionPlan(items, record) : null;
  const published = record.status === 'published';

  const onConfirm = () => {
    if (!pending || deleting) return;
    setDeleting(true);
    const run =
      pending.kind === 'row'
        ? deleteTransaction(pending.item.documentId)
        : purgeExpansion(pending.parentDocumentId);
    const doneKey =
      pending.kind === 'row'
        ? pending.item.converted_to_workflow === CONVERTED_EXPANDED
          ? 'app.transactions_delete_row_done'
          : 'app.transactions_delete_any_row_done'
        : pending.isOriginal
          ? 'app.transactions_purge_expansion_done'
          : 'app.transactions_purge_expansion_rows_done';
    const errorKey =
      pending.kind === 'row'
        ? 'app.transactions_delete_row_error'
        : 'app.transactions_purge_expansion_error';
    void run
      .then(() => {
        notify(doneKey, { type: 'success' });
        const target = pending;
        setPending(null);
        if (target.kind === 'row' && target.item.documentId === currentId) {
          redirect('list', 'transactions');
        } else if (
          target.kind === 'purge' &&
          target.rows.some((row) => row.documentId === currentId)
        ) {
          redirect('show', 'transactions', target.parentDocumentId);
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

  const rowExpanded =
    pending?.kind === 'row' &&
    pending.item.converted_to_workflow === CONVERTED_EXPANDED;
  const confirmBody =
    pending?.kind === 'purge'
      ? pending.isOriginal
        ? 'app.transactions_purge_expansion_body'
        : 'app.transactions_purge_expansion_rows_body'
      : rowExpanded
        ? 'app.transactions_delete_row_body'
        : 'app.transactions_delete_any_row_body';
  const confirmRows =
    pending == null
      ? []
      : pending.kind === 'row'
        ? [pending.item]
        : pending.rows;

  return (
    <Box sx={{ maxWidth: '100%', minWidth: 0, overflowX: 'auto' }}>
      {purgePlan ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Typography color="text.secondary" variant="body2">
            {translate('app.transactions_purge_expansion_hint', {
              count: purgePlan.rows.length,
            })}
          </Typography>
          <Button
            color="error"
            onClick={() =>
              setPending({
                kind: 'purge',
                parentDocumentId: purgePlan.parentDocumentId,
                isOriginal: purgePlan.isOriginal,
                rows: purgePlan.rows,
              })
            }
            size="small"
            startIcon={<DeleteSweepIcon />}
            sx={{ flexShrink: 0 }}
            variant="outlined"
          >
            {translate('app.transactions_purge_expansion', {
              count: purgePlan.rows.length,
            })}
          </Button>
        </Stack>
      ) : null}
      <Table padding="none" size="small" sx={{ minWidth: 540 }}>
        <TableBody>
          {items.map((item) => (
            <RelatedTransactionRow
              currentId={currentId}
              item={item}
              key={item.documentId}
              deleteState={
                canDelete ? relatedRowDeleteState(item, items) : undefined
              }
              isParent={item.documentId === parentId}
              locale={locale}
              locales={locales}
              onDelete={() => setPending({ kind: 'row', item })}
            />
          ))}
        </TableBody>
      </Table>
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
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {confirmRows.map((row) => (
                <Typography component="li" key={row.documentId} variant="body2">
                  {row.entryId ?? '—'} · {formatAmount(row.amount, locales)}
                  {row.currency_type?.code
                    ? ` ${row.currency_type.code}`
                    : ''}{' '}
                  · {row.description || '—'}
                  {row.converted_to_workflow === 'storno'
                    ? ` (${translate('app.converted.storno')})`
                    : ''}
                </Typography>
              ))}
            </Box>
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
            : rowExpanded
              ? 'app.transactions_delete_row_title'
              : 'app.transactions_delete_any_row_title'
        }
      />
    </Box>
  );
}

const deleteTooltipKey: Record<RelatedRowDeleteState, string> = {
  allowed: 'app.transactions_delete_any_row_title',
  blocked_expanded: 'app.transactions_delete_blocked_expanded',
  blocked_storno: 'app.transactions_delete_blocked_storno',
};

function RelatedTransactionRow({
  currentId,
  deleteState,
  isParent,
  item,
  locale,
  locales,
  onDelete,
}: {
  currentId: string;
  /** Undefined: no delete control (not a controller). */
  deleteState?: RelatedRowDeleteState;
  isParent: boolean;
  item: RelatedTransactionItem;
  locale: string;
  locales: string;
  onDelete: () => void;
}) {
  const translate = useTranslate();
  const isCurrent = item.documentId === currentId;
  const convertedKey = convertedLabelKey(item.converted_to_workflow);
  const captions = [
    ...(isParent ? [translate('app.transactions_related_parent_row')] : []),
    ...(convertedKey ? [translate(convertedKey)] : []),
    ...(isCurrent ? [translate('app.transactions_related_current')] : []),
  ];
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
        {captions.length > 0 ? (
          <Typography color="text.secondary" component="div" variant="caption">
            {captions.join(' · ')}
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
        {deleteState ? (
          <Tooltip
            title={translate(
              item.converted_to_workflow === CONVERTED_EXPANDED
                ? 'app.transactions_delete_row_title'
                : deleteTooltipKey[deleteState],
            )}
          >
            {/* span: a disabled button fires no events for the tooltip */}
            <span>
              <IconButton
                aria-label={`${translate('app.transactions_delete_row')} ${item.entryId ?? item.documentId}`}
                color="error"
                disabled={deleteState !== 'allowed'}
                onClick={onDelete}
                size="small"
                sx={{ ml: 0.5, verticalAlign: 'top' }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
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
