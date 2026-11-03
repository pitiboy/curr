import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { Suspense, lazy } from 'react';
import { useTranslate } from 'react-admin';

import type { ConvertPreviewRequest } from '../../data/convertPreview';
import type { WorkflowTemplateHeader } from '../../data/transactionList';

const ConvertPreviewPanel = lazy(() =>
  import('./ConvertPreviewPanel').then((module) => ({
    default: module.ConvertPreviewPanel,
  })),
);

export function ConvertConfirmDialog({
  open,
  onClose,
  onConfirm,
  loading,
  workflow,
  previewInput = null,
  confirmLabelKey = 'app.transactions_convert_confirm',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  workflow: WorkflowTemplateHeader;
  previewInput?: ConvertPreviewRequest | null;
  confirmLabelKey?: string;
}) {
  const translate = useTranslate();

  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      onClose={() => !loading && onClose()}
    >
      <DialogTitle>
        {translate('app.transactions_convert_title', {
          name: workflow.name ?? workflow.documentId,
        })}
      </DialogTitle>
      <DialogContent dividers>
        {previewInput ? (
          <Suspense
            fallback={
              <CircularProgress
                size={28}
                sx={{ display: 'block', mx: 'auto', my: 2 }}
              />
            }
          >
            <ConvertPreviewPanel active={open} previewInput={previewInput} />
          </Suspense>
        ) : (
          <Typography sx={{ py: 1 }} variant="body2">
            {translate('app.transactions_convert_body')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={loading} onClick={onClose}>
          {translate('ra.action.cancel')}
        </Button>
        <Button disabled={loading} variant="contained" onClick={onConfirm}>
          {translate(confirmLabelKey)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
