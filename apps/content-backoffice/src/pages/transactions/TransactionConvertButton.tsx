import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { Button, Stack } from '@mui/material';
import { Suspense, lazy, useMemo, useState } from 'react';
import { useNotify, useRefresh, useTranslate } from 'react-admin';

import { convertTransactionToWorkflow } from '../../data/dataProvider';
import type { ConvertPreviewRequest } from '../../data/convertPreview';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import { strapiErrorMessage } from '../../data/transactionPublish';
import { invalidateTransactionWorkflowCatalog } from '../../workflows/useTransactionWorkflowCatalog';
import { TransactionConvertPreviewButton } from './TransactionConvertPreviewButton';

const ConvertConfirmDialog = lazy(() =>
  import('./ConvertConfirmDialog').then((module) => ({
    default: module.ConvertConfirmDialog,
  })),
);

export function TransactionConvertButton({
  documentId,
  workflow,
  disabled,
  labelKey = 'app.transactions_convert',
  showPreview = true,
}: {
  documentId: string;
  workflow: WorkflowTemplateHeader;
  disabled?: boolean;
  labelKey?: string;
  showPreview?: boolean;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const previewInput = useMemo<ConvertPreviewRequest>(
    () => ({
      workflowDocumentId: workflow.documentId,
      transactionDocumentId: documentId,
    }),
    [documentId, workflow.documentId],
  );

  const onConfirm = () => {
    if (busy) return;
    setBusy(true);
    void convertTransactionToWorkflow(documentId, workflow.documentId)
      .then(() => {
        notify('app.transactions_convert_done', { type: 'success' });
        setOpen(false);
        refresh();
      })
      .catch((error: unknown) => {
        const message = strapiErrorMessage(error);
        if (message.includes('transaction-workflow not found')) {
          invalidateTransactionWorkflowCatalog();
        }
        notify(message || translate('app.transactions_convert_error'), {
          type: 'error',
        });
      })
      .finally(() => setBusy(false));
  };

  return (
    <>
      <Stack direction="row" spacing={1}>
        {showPreview ? (
          <TransactionConvertPreviewButton
            previewInput={previewInput}
            workflow={workflow}
          />
        ) : null}
        <Button
          disabled={disabled || busy}
          size="small"
          startIcon={<AccountTreeIcon />}
          variant="outlined"
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
        >
          {translate(labelKey)}
        </Button>
      </Stack>
      {open ? (
        <Suspense fallback={null}>
          <ConvertConfirmDialog
            loading={busy}
            open={open}
            previewInput={previewInput}
            workflow={workflow}
            onClose={() => !busy && setOpen(false)}
            onConfirm={onConfirm}
          />
        </Suspense>
      ) : null}
    </>
  );
}
