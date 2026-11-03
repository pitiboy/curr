import { Alert, CircularProgress, Stack, Typography } from '@mui/material';
import { useTranslate } from 'react-admin';

import type { ConvertPreviewRequest } from '../../data/convertPreview';
import { useConvertPreview } from '../../workflows/useConvertPreview';
import { ConvertPreviewDiagram } from './ConvertPreviewDiagram';
import { ConvertPreviewTable } from './ConvertPreviewTable';

export function ConvertPreviewPanel({
  previewInput,
  active,
}: {
  previewInput: ConvertPreviewRequest;
  active: boolean;
}) {
  const translate = useTranslate();
  const { preview, loading, error } = useConvertPreview(previewInput, active);

  if (loading) {
    return (
      <Stack sx={{ alignItems: 'center', py: 3 }}>
        <CircularProgress size={32} />
        <Typography sx={{ mt: 1 }} variant="body2">
          {translate('app.transactions_convert_preview_loading')}
        </Typography>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 1 }}>
        {error || translate('app.transactions_convert_preview_error')}
      </Alert>
    );
  }

  if (!preview) {
    return (
      <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
        {translate('app.transactions_convert_preview_empty')}
      </Typography>
    );
  }

  return (
    <Stack spacing={1} sx={{ mt: 0.5 }}>
      <Typography color="text.secondary" variant="body2">
        {preview.workflow.keepOriginal
          ? translate('app.transactions_convert_preview_keep_original')
          : translate('app.transactions_convert_preview_delete_original')}
        {' · '}
        {preview.workflow.stepsPublished
          ? translate('app.transactions_convert_preview_steps_published')
          : translate('app.transactions_convert_preview_steps_draft')}
      </Typography>
      {preview.warnings.map((warning) => (
        <Alert key={warning} severity="warning">
          {warning}
        </Alert>
      ))}
      <ConvertPreviewDiagram preview={preview} />
      <ConvertPreviewTable preview={preview} />
    </Stack>
  );
}
