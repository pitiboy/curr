import { Box, Typography } from '@mui/material';
import { Title, useTranslate } from 'react-admin';

type EmptyStateProps = {
  titleKey: string;
  bodyKey: string;
};

export function EmptyState({ titleKey, bodyKey }: EmptyStateProps) {
  const translate = useTranslate();

  return (
    <Box sx={{ p: 2 }}>
      <Title title={titleKey} />
      <Typography color="text.secondary" variant="body1">
        {translate(bodyKey)}
      </Typography>
    </Box>
  );
}
