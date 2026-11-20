import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { Button, Stack } from '@mui/material';
import { useMemo, useState } from 'react';
import { useNotify, useRefresh, useTranslate } from 'react-admin';

import { convertTransactionToWorkflow } from '../../data/dataProvider';
import type { ConvertOverridesPayload } from '../../data/transactionWorkflow';
import type { ConvertPreviewRequest } from '../../data/convertPreview';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import { strapiErrorMessage } from '../../data/transactionPublish';
import { useSubmitGuard } from '../../submit/useSubmitGuard';
import { invalidateTransactionWorkflowCatalog } from '../../workflows/useTransactionWorkflowCatalog';
import { useAssetFormAfterBooking } from '../assets/useAssetFormAfterBooking';
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
  const openAssetForm = useAssetFormAfterBooking();
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const previewInput = useMemo<ConvertPreviewRequest>(
    () => ({
      workflowDocumentId: workflow.documentId,
      transactionDocumentId: documentId,
    }),
    [documentId, workflow.documentId],
  );

  // A transaction converts once; stay locked until the refresh hides the button.
  const convertGuard = useSubmitGuard<
    ConvertOverridesPayload | null | undefined
  >({
    lockOnSuccess: true,
    run: (overrides) =>
      convertTransactionToWorkflow(
        documentId,
        workflow.documentId,
        overrides ?? undefined,
      ),
    onSuccess: (result) => {
      notify('app.transactions_convert_done', { type: 'success' });
      setOpen(false);
      setEditMode(false);
      refresh();
      void openAssetForm(workflow, documentId, result);
    },
    onError: (error: unknown) => {
      const message = strapiErrorMessage(error);
      if (message.includes('transaction-workflow not found')) {
        invalidateTransactionWorkflowCatalog();
      }
      if (
        message.includes('ki van fejtve') ||
        message.includes('TRANSACTION_ALREADY_CONVERTED')
      ) {
        refresh();
      }
      notify(message || translate('app.transactions_convert_error'), {
        type: 'error',
      });
    },
  });
  const busy = convertGuard.busy;

  const onConfirm = (overrides?: ConvertOverridesPayload | null) => {
    convertGuard.submit(overrides);
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
          editMode={editMode}
          loading={busy}
          open={open}
          previewInput={previewInput}
          workflow={workflow}
          onClose={() => {
            if (busy) return;
            setOpen(false);
            setEditMode(false);
          }}
          onConfirm={onConfirm}
          onEditModeChange={setEditMode}
        />
      ) : null}
    </>
  );
}
