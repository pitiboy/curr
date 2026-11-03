import PreviewIcon from '@mui/icons-material/Preview';
import { Button, Tooltip } from '@mui/material';
import { useMemo, useState } from 'react';
import { useTranslate } from 'react-admin';

import type { ConvertPreviewRequest } from '../../data/convertPreview';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import { ConvertPreviewDialog } from './ConvertPreviewDialog';

export function TransactionConvertPreviewButton({
  workflow,
  previewInput,
  disabled,
  disabledReasonKey,
  size = 'small',
  iconOnly = false,
}: {
  workflow: WorkflowTemplateHeader;
  previewInput?: ConvertPreviewRequest | null;
  disabled?: boolean;
  disabledReasonKey?: string;
  size?: 'small' | 'medium';
  iconOnly?: boolean;
}) {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  const input = useMemo(() => {
    if (!previewInput) return null;
    return {
      ...previewInput,
      workflowDocumentId: workflow.documentId,
    };
  }, [previewInput, workflow.documentId]);

  const isDisabled = disabled || !input;

  const openPreview = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!isDisabled && input) setOpen(true);
  };

  const button = iconOnly ? (
    <Button
      aria-label={translate('app.transactions_convert_preview')}
      disabled={isDisabled}
      size={size}
      variant="outlined"
      onClick={openPreview}
    >
      <PreviewIcon fontSize="small" />
    </Button>
  ) : (
    <Button
      disabled={isDisabled}
      size={size}
      startIcon={<PreviewIcon />}
      variant="outlined"
      onClick={openPreview}
    >
      {translate('app.transactions_convert_preview')}
    </Button>
  );

  return (
    <>
      {isDisabled && disabledReasonKey ? (
        <Tooltip title={translate(disabledReasonKey)}>
          <span>{button}</span>
        </Tooltip>
      ) : (
        button
      )}
      {open && input ? (
        <ConvertPreviewDialog
          open={open}
          previewInput={input}
          workflow={workflow}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
