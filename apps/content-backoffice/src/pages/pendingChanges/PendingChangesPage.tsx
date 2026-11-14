import PendingActionsIcon from '@mui/icons-material/PendingActions';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useCallback, useMemo, useState } from 'react';
import { Title, useDataProvider, useRefresh, useTranslate } from 'react-admin';
import { strapiHttpClient } from 'ra-strapi';

import { dataProviderInner } from '../../data/dataProvider';
import {
  removePendingChange,
  listPendingChangesForCurrentUser,
} from '../../data/pendingChanges/store';
import { retrySinglePendingChange } from '../../data/pendingChanges/retryRunner';
import type { PendingChangeItem } from '../../data/pendingChanges/types';

import { usePendingChangesList } from './usePendingChangesCount';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('hu-HU');
  } catch {
    return iso;
  }
}

export function PendingChangesPage() {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const refresh = useRefresh();
  const httpClient = useMemo(() => strapiHttpClient(), []);
  const { items, reload } = usePendingChangesList();
  const [discardTarget, setDiscardTarget] = useState<PendingChangeItem | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const invalidate = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleRetry = useCallback(
    async (item: PendingChangeItem) => {
      setBusyId(item.id);
      try {
        await retrySinglePendingChange(
          item,
          dataProvider,
          () => invalidate(),
          dataProviderInner,
          httpClient,
        );
        await reload();
      } finally {
        setBusyId(null);
      }
    },
    [dataProvider, httpClient, invalidate, reload],
  );

  const handleRetryAll = useCallback(async () => {
    const rows = await listPendingChangesForCurrentUser();
    for (const item of rows) {
      if (item.status === 'pending') {
        try {
          await retrySinglePendingChange(
            item,
            dataProvider,
            () => invalidate(),
            dataProviderInner,
            httpClient,
          );
        } catch {
          // continue with next items; FIFO guard may block some
        }
      }
    }
    await reload();
  }, [dataProvider, httpClient, invalidate, reload]);

  const confirmDiscard = useCallback(async () => {
    if (!discardTarget) return;
    await removePendingChange(discardTarget.id);
    setDiscardTarget(null);
    await reload();
  }, [discardTarget, reload]);

  const list = items ?? [];
  const hasPending = list.some((item) => item.status === 'pending');

  return (
    <Box sx={{ p: 2 }}>
      <Title title="app.pending_changes.menu" />
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <PendingActionsIcon color="action" />
          <Typography variant="h6">
            {translate('app.pending_changes.title')}
          </Typography>
        </Stack>
        {hasPending ? (
          <Button onClick={() => void handleRetryAll()} variant="contained">
            {translate('app.pending_changes.retry_all')}
          </Button>
        ) : null}
      </Stack>
      {list.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4 }}>
          {translate('app.pending_changes.empty')}
        </Typography>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  {translate('app.pending_changes.col_time')}
                </TableCell>
                <TableCell>
                  {translate('app.pending_changes.col_resource')}
                </TableCell>
                <TableCell>
                  {translate('app.pending_changes.col_operation')}
                </TableCell>
                <TableCell>
                  {translate('app.pending_changes.col_summary')}
                </TableCell>
                <TableCell>
                  {translate('app.pending_changes.col_attempts')}
                </TableCell>
                <TableCell>
                  {translate('app.pending_changes.col_error')}
                </TableCell>
                <TableCell>
                  {translate('app.pending_changes.col_status')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.pending_changes.col_actions')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatWhen(item.createdAt)}</TableCell>
                  <TableCell>
                    {translate(`resources.${item.resource}.name`, {
                      _: item.resource,
                    })}
                  </TableCell>
                  <TableCell>
                    {translate(
                      `app.pending_changes.operation.${item.customName ?? item.operation}`,
                    )}
                  </TableCell>
                  <TableCell>{item.summary || '—'}</TableCell>
                  <TableCell>{item.attemptCount}</TableCell>
                  <TableCell sx={{ maxWidth: 240 }}>
                    <Typography
                      noWrap
                      title={
                        item.lastError
                          ? /failed to fetch/i.test(item.lastError)
                            ? translate('app.pending_changes.error_offline')
                            : item.lastError
                          : undefined
                      }
                    >
                      {item.lastError
                        ? /failed to fetch/i.test(item.lastError)
                          ? translate('app.pending_changes.error_offline')
                          : item.lastError
                        : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {translate(`app.pending_changes.status.${item.status}`)}
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ justifyContent: 'flex-end' }}
                    >
                      {item.status === 'pending' ? (
                        <Button
                          disabled={busyId === item.id}
                          onClick={() => void handleRetry(item)}
                          size="small"
                        >
                          {translate('app.pending_changes.retry')}
                        </Button>
                      ) : null}
                      <Button
                        color="warning"
                        onClick={() => setDiscardTarget(item)}
                        size="small"
                      >
                        {translate('app.pending_changes.discard')}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
      <Dialog
        onClose={() => setDiscardTarget(null)}
        open={discardTarget !== null}
      >
        <DialogTitle>
          {translate('app.pending_changes.discard_title')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {translate('app.pending_changes.discard_body')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardTarget(null)}>
            {translate('ra.action.cancel')}
          </Button>
          <Button color="warning" onClick={() => void confirmDiscard()}>
            {translate('app.pending_changes.discard')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
