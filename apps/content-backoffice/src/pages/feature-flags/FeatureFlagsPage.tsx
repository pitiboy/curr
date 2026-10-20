import {
  Box,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { Title, useTranslate } from 'react-admin';

import { useBackofficeConfig } from '../../workflows/useBackofficeConfig';

export function FeatureFlagsPage() {
  const translate = useTranslate();
  const {
    available,
    effective,
    hasOverride,
    ready,
    setOverride,
    clearOverride,
  } = useBackofficeConfig();

  const toggle = (id: string, on: boolean) => {
    const next = on
      ? [...effective, id]
      : effective.filter((item) => item !== id);
    setOverride(next);
  };

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Title title="app.feature_flags" />
      {ready && available.length === 0 ? (
        <Typography color="text.secondary" variant="body1">
          {translate('app.feature_flags_empty')}
        </Typography>
      ) : null}
      {ready && available.length > 0 ? (
        <Stack spacing={1}>
          {available.map((id) => (
            <FormControlLabel
              key={id}
              control={
                <Switch
                  checked={effective.includes(id)}
                  onChange={(_event, checked) => toggle(id, checked)}
                />
              }
              label={translate(`app.workflows.${id}`, { _: id })}
            />
          ))}
        </Stack>
      ) : null}
      {hasOverride ? (
        <Button onClick={clearOverride} sx={{ mt: 2 }}>
          {translate('app.feature_flags_reset')}
        </Button>
      ) : null}
    </Box>
  );
}
