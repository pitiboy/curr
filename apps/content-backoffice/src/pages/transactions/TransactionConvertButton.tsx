import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { Button, Stack } from '@mui/material';
import { useMemo, useState } from 'react';
import { useNotify, useRefresh, useTranslate } from 'react-admin';

import { convertTransactionToWorkflow } from '../../data/dataProvider';
import type { ConvertPreviewRequest } from '../../data/convertPreview';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import { strapiErrorMessage } from '../../data/transactionPublish';
import { invalidateTransactionWorkflowCatalog } from '../../workflows/useTransactionWorkflowCatalog';
import { ConvertConfirmDialog } from './ConvertConfirmDialog';
import { TransactionConvertPreviewButton } from './TransactionConvertPreviewButton';

export function TransactionConvertButton({
  documentId,
  workflow,
  disabled,
  iconOnly = false,
  labelKey = 'app.transactions_convert',
  showPreview = true,
  /** Create/review toolbar: contained convert, default size, no icon. */
  toolbarStyle = false,
}: {
  documentId: string;
  workflow: WorkflowTemplateHeader;
  disabled?: boolean;
  iconOnly?: boolean;
  labelKey?: string;
  showPreview?: boolean;
  toolbarStyle?: boolean;
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
      <Stack
        direction="row"
        spacing={1}
        sx={toolbarStyle ? { ml: 1 } : undefined}
      >
        {showPreview ? (
          <TransactionConvertPreviewButton
            disabled={disabled || busy}
            previewInput={previewInput}
            workflow={workflow}
          />
        ) : null}
        {iconOnly ? (
          <Button
            aria-label={translate(labelKey)}
            disabled={disabled || busy}
            size="small"
            variant="outlined"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}
          >
            <AccountTreeIcon fontSize="small" />
          </Button>
        ) : (
          <Button
            disabled={disabled || busy}
            size={toolbarStyle ? 'medium' : 'small'}
            startIcon={toolbarStyle ? undefined : <AccountTreeIcon />}
            variant={toolbarStyle ? 'contained' : 'outlined'}
            onClick={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}
          >
            {translate(labelKey)}
          </Button>
        )}
      </Stack>
      {open ? (
        <ConvertConfirmDialog
          loading={busy}
          open={open}
          previewInput={previewInput}
          workflow={workflow}
          onClose={() => !busy && setOpen(false)}
          onConfirm={onConfirm}
        />
      ) : null}
    </>
  );
}
