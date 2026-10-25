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
import { useBackofficeConfig } from '../../workflows/useBackofficeConfig';

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
  const { publisherMustDiffer } = useBackofficeConfig();
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
        const next = classifyBulkApproveRows(rows, editorEmail, {
          publisherMustDiffer,
        });
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
  const skippedCount = pending?.skipped.length ?? 0;
  const confirmContent =
    skippedCount > 0
      ? publisherMustDiffer
        ? 'app.transactions_bulk_finalize_body_partial'
        : 'app.transactions_bulk_finalize_body_partial_no_self_block'
      : 'app.transactions_bulk_finalize_body';

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
        content={confirmContent}
        contentTranslateOptions={
          skippedCount > 0
            ? { ready: readyCount, skipped: skippedCount }
            : undefined
        }
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
  skipped: Array<{ reason: BulkApproveSkipReason }>,
  translate: (key: string, options?: Record<string, unknown>) => string,
  notify: ReturnType<typeof useNotify>,
) {
  const counts = countSkipReasons(skipped);
  if (counts.incomplete) {
    pluralNotify(notify, 'app.transactions_bulk_incomplete', counts.incomplete, 'warning');
    return;
  }
  if (counts.same_person) {
    pluralNotify(notify, 'app.transactions_bulk_same_person', counts.same_person, 'warning');
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

  pluralNotify(
    notify,
    'app.transactions_bulk_done',
    outcome.succeeded.length,
    'success',
  );
  pluralNotify(
    notify,
    'app.transactions_bulk_skipped_incomplete',
    skipCounts.incomplete,
    'warning',
  );
  pluralNotify(
    notify,
    'app.transactions_bulk_skipped_same_person',
    skipCounts.same_person + failedSamePerson,
    'warning',
  );
  pluralNotify(notify, 'app.transactions_bulk_failed', failedOther, 'error');
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
