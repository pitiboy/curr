import { Box } from '@mui/material';

import { visibleDescription } from './descriptionComment';

export function DescriptionText({ value }: { value: unknown }) {
  const text = visibleDescription(value);
  if (!text) return '—';
  return (
    <Box component="span" sx={{ whiteSpace: 'pre-line' }}>
      {text}
    </Box>
  );
}
