import PreviewIcon from '@mui/icons-material/Preview';
import { Button, CircularProgress, Tooltip } from '@mui/material';
import { Suspense, lazy, useMemo, useState } from 'react';
import { useTranslate } from 'react-admin';

import type { ConvertPreviewRequest } from '../../data/convertPreview';
import type { WorkflowTemplateHeader } from '../../data/transactionList';

const ConvertPreviewDialog = lazy(() =>
  import('./ConvertPreviewDialog').then((module) => ({
    default: module.ConvertPreviewDialog,
  })),
);

export function TransactionConvertPreviewButton({
  workflow,
  previewInput,
  disabled,
  disabledReasonKey,
  size = 'small',
  iconOnly = false,
}: {
  workflow: WorkflowTemplateHeader;
  previewInput: ConvertPreviewRequest;
  disabled?: boolean;
  disabledReasonKey?: string;
  size?: 'small' | 'medium';
  iconOnly?: boolean;
}) {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  const input = useMemo(
    () => ({
      ...previewInput,
      workflowDocumentId: workflow.documentId,
    }),
    [previewInput, workflow.documentId],
  );

  const button = iconOnly ? (
    <Button
      aria-label={translate('app.transactions_convert_preview')}
      disabled={disabled}
      size={size}
      variant="outlined"
      onClick={(event) => {
        event.stopPropagation();
        setOpen(true);
      }}
    >
      <PreviewIcon fontSize="small" />
    </Button>
  ) : (
    <Button
      disabled={disabled}
      size={size}
      startIcon={<PreviewIcon />}
      variant="outlined"
      onClick={(event) => {
        event.stopPropagation();
        setOpen(true);
      }}
    >
      {translate('app.transactions_convert_preview')}
    </Button>
  );

  return (
    <>
      {disabled && disabledReasonKey ? (
        <Tooltip title={translate(disabledReasonKey)}>
          <span>{button}</span>
        </Tooltip>
      ) : (
        button
      )}
      {open ? (
        <Suspense
          fallback={<CircularProgress size={24} sx={{ display: 'none' }} />}
        >
          <ConvertPreviewDialog
            open={open}
            previewInput={input}
            workflow={workflow}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
