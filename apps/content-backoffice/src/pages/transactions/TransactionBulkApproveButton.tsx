import CheckIcon from '@mui/icons-material/Check';
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

import { fetchProfileFields } from '../../auth/authProvider';
import {
  bulkPublishTransactions,
  classifyBulkApproveRows,
  type BulkApproveClassification,
  type BulkApproveSkipReason,
} from '../../data/transactionBulkApprove';
import { publishTransaction } from '../../data/dataProvider';
import type { TransactionRow } from '../../data/transactionList';

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

export function TransactionBulkApproveButton() {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const unselectAll = useUnselectAll('transactions');
  const { selectedIds, data } = useListContext<TransactionRow>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BulkApproveClassification | null>(
    null,
  );

  const rows = useMemo(
    () => selectedRows(selectedIds, data),
    [data, selectedIds],
  );

  const openConfirm = () => {
    if (!selectedIds.length || busy) return;

    void fetchProfileFields()
      .then(({ email }) => {
        const editorEmail = email === '—' ? '' : email;
        const next = classifyBulkApproveRows(rows, editorEmail);
        if (!next.ready.length) {
          notifySkipped(next.skipped, translate, notify);
          return;
        }
        setPending(next);
        setOpen(true);
      })
      .catch(() => {
        notify('ra.notification.http_error', { type: 'error' });
      });
  };

  const onConfirm = () => {
    const ready = pending?.ready ?? [];
    if (!ready.length || busy) return;
    setBusy(true);
    void bulkPublishTransactions(
      ready.map((row) => row.documentId),
      publishTransaction,
    )
      .then((outcome) => {
        setOpen(false);
        setPending(null);
        unselectAll();
        refresh();
        notifyBulkOutcome(
          outcome,
          pending?.skipped ?? [],
          translate,
          notify,
        );
      })
      .catch(() => {
        notify('ra.notification.http_error', { type: 'error' });
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const readyCount = pending?.ready.length ?? 0;

  return (
    <Fragment>
      <Button
        label="app.transactions_bulk_finalize"
        disabled={!selectedIds.length || busy}
        onClick={(event) => {
          event.stopPropagation();
          openConfirm();
        }}
      >
        <CheckIcon />
      </Button>
      <Confirm
        confirm="app.transactions_bulk_finalize_confirm"
        content="app.transactions_bulk_finalize_body"
        isOpen={open}
        loading={busy}
        title="app.transactions_bulk_finalize_title"
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

function notifySkipped(
  skipped: Array<{ reason: BulkApproveSkipReason }>,
  translate: (key: string, options?: Record<string, unknown>) => string,
  notify: ReturnType<typeof useNotify>,
) {
  const counts = countSkipReasons(skipped);
  if (counts.incomplete) {
    notify('app.transactions_bulk_incomplete', {
      type: 'warning',
      messageArgs: { count: counts.incomplete },
    });
    return;
  }
  if (counts.same_person) {
    notify('app.transactions_bulk_same_person', {
      type: 'warning',
      messageArgs: { count: counts.same_person },
    });
    return;
  }
  notify(translate('app.transactions_bulk_none_ready'), { type: 'warning' });
}

function notifyBulkOutcome(
  outcome: Awaited<ReturnType<typeof bulkPublishTransactions>>,
  skipped: Array<{ reason: BulkApproveSkipReason }>,
  translate: (key: string, options?: Record<string, unknown>) => string,
  notify: ReturnType<typeof useNotify>,
) {
  const skipCounts = countSkipReasons(skipped);
  const failedSamePerson = outcome.failed.filter((row) => row.samePerson).length;
  const failedOther = outcome.failed.length - failedSamePerson;

  if (outcome.succeeded.length) {
    notify('app.transactions_bulk_done', {
      type: 'success',
      messageArgs: { count: outcome.succeeded.length },
    });
  }

  if (skipCounts.incomplete) {
    notify('app.transactions_bulk_skipped_incomplete', {
      type: 'warning',
      messageArgs: { count: skipCounts.incomplete },
    });
  }
  if (skipCounts.same_person + failedSamePerson) {
    notify('app.transactions_bulk_skipped_same_person', {
      type: 'warning',
      messageArgs: { count: skipCounts.same_person + failedSamePerson },
    });
  }
  if (failedOther) {
    notify('app.transactions_bulk_failed', {
      type: 'error',
      messageArgs: { count: failedOther },
    });
  }
  if (
    !outcome.succeeded.length &&
    !skipCounts.incomplete &&
    !skipCounts.same_person &&
    !outcome.failed.length
  ) {
    notify(translate('app.transactions_bulk_none_ready'), { type: 'warning' });
  }
}

function countSkipReasons(
  skipped: Array<{ reason: BulkApproveSkipReason }>,
): Record<BulkApproveSkipReason, number> {
  return skipped.reduce(
    (counts, entry) => {
      counts[entry.reason] += 1;
      return counts;
    },
    { not_draft: 0, incomplete: 0, same_person: 0 },
  );
}
