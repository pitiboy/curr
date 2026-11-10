import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { Fragment, useMemo, useState } from 'react';
import {
  Confirm,
  useListContext,
  useNotify,
  useRefresh,
  useTranslate,
  useUnselectAll,
  Button,
} from 'react-admin';

import {
  bulkConvertTransactions,
  classifyBulkConvertRows,
  type BulkConvertClassification,
  type BulkConvertSkipReason,
} from '../../data/transactionBulkConvert';
import { convertTransactionToWorkflow } from '../../data/dataProvider';
import type { TransactionRow } from '../../data/transactionList';
import {
  invalidateTransactionWorkflowCatalog,
  useTransactionWorkflowCatalog,
} from '../../workflows/useTransactionWorkflowCatalog';

function selectedRows(
  selectedIds: string[],
  data: readonly TransactionRow[] | undefined,
): TransactionRow[] {
  if (!data?.length || !selectedIds.length) return [];
  const byId = new Map(data.map((row) => [String(row.id), row]));
  return selectedIds
    .map((id) => byId.get(String(id)))
    .filter((row): row is TransactionRow => Boolean(row));
}

export function TransactionBulkConvertButton() {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const unselectAll = useUnselectAll('transactions');
  const { selectedIds, data } = useListContext<TransactionRow>();
  const { workflows, loading: catalogLoading } =
    useTransactionWorkflowCatalog();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BulkConvertClassification | null>(
    null,
  );

  const rows = useMemo(
    () => selectedRows(selectedIds, data),
    [data, selectedIds],
  );

  const openConfirm = () => {
    if (!selectedIds.length || busy || catalogLoading) return;

    const next = classifyBulkConvertRows(rows, workflows);
    if (!next.ready.length) {
      notifySkipped(next.skipped, translate, notify);
      return;
    }
    setPending(next);
    setOpen(true);
  };

  const onConfirm = () => {
    const ready = pending?.ready ?? [];
    if (!ready.length || busy) return;
    setBusy(true);
    void bulkConvertTransactions(
      ready.map((item) => ({
        transactionDocumentId: item.record.documentId,
        workflowDocumentId: item.workflow.documentId,
      })),
      convertTransactionToWorkflow,
    )
      .then((outcome) => {
        setOpen(false);
        setPending(null);
        unselectAll();
        refresh();
        if (
          outcome.failed.some((row) =>
            row.message.includes('transaction-workflow not found'),
          )
        ) {
          invalidateTransactionWorkflowCatalog();
        }
        notifyBulkOutcome(outcome, pending?.skipped ?? [], translate, notify);
      })
      .catch(() => {
        notify('ra.notification.http_error', { type: 'error' });
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const readyCount = pending?.ready.length ?? 0;
  const skippedCount = pending?.skipped.length ?? 0;
  const confirmContent =
    skippedCount > 0
      ? 'app.transactions_bulk_convert_body_partial'
      : 'app.transactions_bulk_convert_body';

  return (
    <Fragment>
      <Button
        label="app.transactions_convert_confirm"
        disabled={!selectedIds.length || busy || catalogLoading}
        onClick={(event) => {
          event.stopPropagation();
          openConfirm();
        }}
      >
        <AccountTreeIcon />
      </Button>
      <Confirm
        confirm="app.transactions_bulk_convert_confirm"
        content={confirmContent}
        contentTranslateOptions={
          skippedCount > 0
            ? { ready: readyCount, skipped: skippedCount }
            : undefined
        }
        isOpen={open}
        loading={busy}
        title="app.transactions_bulk_convert_title"
        titleTranslateOptions={{ smart_count: readyCount }}
        onClose={() => {
          setOpen(false);
          setPending(null);
        }}
        onConfirm={onConfirm}
      />
    </Fragment>
  );
}

function pluralNotify(
  notify: ReturnType<typeof useNotify>,
  messageKey: string,
  count: number,
  type: 'warning' | 'success' | 'error',
) {
  if (count <= 0) return;
  notify(messageKey, {
    type,
    messageArgs: pluralArgs(count),
  });
}

function pluralArgs(count: number) {
  return { smart_count: count, count };
}

function notifySkipped(
  skipped: Array<{ reason: BulkConvertSkipReason }>,
  translate: (key: string, options?: Record<string, unknown>) => string,
  notify: ReturnType<typeof useNotify>,
) {
  const counts = countSkipReasons(skipped);
  if (counts.already_converted) {
    pluralNotify(
      notify,
      'app.transactions_bulk_convert_skipped_converted',
      counts.already_converted,
      'warning',
    );
    return;
  }
  if (counts.no_match) {
    pluralNotify(
      notify,
      'app.transactions_bulk_convert_skipped_no_match',
      counts.no_match,
      'warning',
    );
    return;
  }
  if (counts.ambiguous) {
    pluralNotify(
      notify,
      'app.transactions_bulk_convert_skipped_ambiguous',
      counts.ambiguous,
      'warning',
    );
    return;
  }
  notify(translate('app.transactions_bulk_convert_none_ready'), {
    type: 'warning',
  });
}

function notifyBulkOutcome(
  outcome: Awaited<ReturnType<typeof bulkConvertTransactions>>,
  skipped: Array<{ reason: BulkConvertSkipReason }>,
  translate: (key: string, options?: Record<string, unknown>) => string,
  notify: ReturnType<typeof useNotify>,
) {
  const skipCounts = countSkipReasons(skipped);

  pluralNotify(
    notify,
    'app.transactions_bulk_convert_done',
    outcome.succeeded.length,
    'success',
  );
  pluralNotify(
    notify,
    'app.transactions_bulk_convert_skipped_converted',
    skipCounts.already_converted,
    'warning',
  );
  pluralNotify(
    notify,
    'app.transactions_bulk_convert_skipped_no_match',
    skipCounts.no_match,
    'warning',
  );
  pluralNotify(
    notify,
    'app.transactions_bulk_convert_skipped_ambiguous',
    skipCounts.ambiguous,
    'warning',
  );
  pluralNotify(
    notify,
    'app.transactions_bulk_convert_failed',
    outcome.failed.length,
    'error',
  );
  if (
    !outcome.succeeded.length &&
    !skipCounts.already_converted &&
    !skipCounts.no_match &&
    !skipCounts.ambiguous &&
    !outcome.failed.length
  ) {
    notify(translate('app.transactions_bulk_convert_none_ready'), {
      type: 'warning',
    });
  }
}

function countSkipReasons(
  skipped: Array<{ reason: BulkConvertSkipReason }>,
): Record<BulkConvertSkipReason, number> {
  return skipped.reduce(
    (counts, entry) => {
      counts[entry.reason] += 1;
      return counts;
    },
    { already_converted: 0, no_match: 0, ambiguous: 0 },
  );
}
