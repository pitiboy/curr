import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslate } from 'react-admin';

import type { ConvertPreviewRequest } from '../../data/convertPreview';
import type { ConvertOverridesPayload } from '../../data/transactionWorkflow';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import {
  ConvertPreviewPanel,
  type ConvertPreviewEditState,
} from './ConvertPreviewPanel';

export function ConvertConfirmDialog({
  open,
  onClose,
  onConfirm,
  loading,
  workflow,
  previewInput = null,
  confirmLabelKey = 'app.transactions_convert_confirm',
  editMode = false,
  onEditModeChange,
  onEditStateChange,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (overrides?: ConvertOverridesPayload | null) => void;
  loading: boolean;
  workflow: WorkflowTemplateHeader;
  previewInput?: ConvertPreviewRequest | null;
  confirmLabelKey?: string;
  editMode?: boolean;
  onEditModeChange?: (value: boolean) => void;
  onEditStateChange?: (state: ConvertPreviewEditState) => void;
}) {
  const translate = useTranslate();
  const [editState, setEditState] = useState<ConvertPreviewEditState | null>(
    null,
  );
  const confirmBlocked = (editState?.blocking.length ?? 0) > 0;

  return (
    <Dialog
      fullWidth
      maxWidth="xl"
      open={open}
      onClose={() => !loading && onClose()}
      slotProps={{
        paper: {
          sx: { maxWidth: 1440 },
        },
      }}
    >
      <DialogTitle>
        {translate('app.transactions_convert_title', {
          name: workflow.name ?? workflow.documentId,
        })}
      </DialogTitle>
      <DialogContent dividers>
        {previewInput ? (
          <ConvertPreviewPanel
            active={open}
            editMode={editMode}
            previewInput={previewInput}
            onEditModeChange={onEditModeChange}
            onEditStateChange={(state) => {
              setEditState((prev) => {
                if (
                  prev &&
                  prev.editMode === state.editMode &&
                  prev.overridePayload === state.overridePayload &&
                  prev.editedRows === state.editedRows &&
                  prev.blocking === state.blocking
                ) {
                  return prev;
                }
                return state;
              });
              onEditStateChange?.(state);
            }}
          />
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
        <Button
          disabled={loading || confirmBlocked}
          variant="contained"
          onClick={() => onConfirm(editState?.overridePayload ?? null)}
        >
          {translate(confirmLabelKey)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
