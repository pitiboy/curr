import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { useTranslate } from 'react-admin';

import type { ConvertPreviewRequest } from '../../data/convertPreview';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import { ConvertPreviewPanel } from './ConvertPreviewPanel';

export function ConvertPreviewDialog({
  open,
  onClose,
  workflow,
  previewInput,
}: {
  open: boolean;
  onClose: () => void;
  workflow: WorkflowTemplateHeader;
  previewInput: ConvertPreviewRequest;
}) {
  const translate = useTranslate();

  return (
    <Dialog
      fullWidth
      maxWidth="xl"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { maxWidth: 1440 },
        },
      }}
    >
      <DialogTitle>{workflow.name ?? workflow.documentId}</DialogTitle>
      <DialogContent dividers>
        <ConvertPreviewPanel active={open} previewInput={previewInput} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{translate('ra.action.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
