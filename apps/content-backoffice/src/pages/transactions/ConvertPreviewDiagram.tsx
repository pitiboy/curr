import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import {
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
  useTheme,
  type Theme,
} from '@mui/material';
import { useTranslate } from 'react-admin';

import type { ConvertPreview } from '../../data/convertPreview';
import {
  buildMovementSequence,
  formatSequenceAmount,
  movementSequenceAriaSummary,
  type MovementSequenceFrame,
  type MovementSequenceKind,
  type SequenceStepColorKey,
} from '../../data/convertPreviewGraph';

function paletteColor(theme: Theme, key: SequenceStepColorKey): string {
  return theme.palette[key].main;
}

function kindLabelKey(kind: MovementSequenceKind): string {
  if (kind === 'original') return 'app.transactions_convert_preview_kind_original';
  if (kind === 'storno') return 'app.transactions_convert_preview_kind_storno';
  return 'app.transactions_convert_preview_kind_step';
}

function frameAccent(theme: Theme, frame: MovementSequenceFrame): string {
  if (frame.kind === 'original') return theme.palette.info.main;
  if (frame.kind === 'storno') return theme.palette.error.main;
  return paletteColor(theme, frame.stepColorKey);
}

function AccountChip({
  account,
  side,
}: {
  account: MovementSequenceFrame['debit'];
  side: 'debit' | 'credit';
}) {
  const theme = useTheme();
  const translate = useTranslate();
  const member = account.isMember;
  return (
    <Paper
      elevation={0}
      sx={{
        px: 1.5,
        py: 1,
        minWidth: { xs: '7rem', sm: '9rem' },
        flex: '1 1 0',
        border: 2,
        borderColor: member ? theme.palette.warning.main : 'divider',
        bgcolor: member ? theme.palette.warning.light : 'background.paper',
      }}
      variant="outlined"
    >
      <Typography fontWeight={700} variant="body2">
        {account.code}
      </Typography>
      {account.name ? (
        <Typography color="text.secondary" variant="caption">
          {account.name}
        </Typography>
      ) : null}
      <Typography color="text.secondary" display="block" variant="caption">
        {side === 'debit'
          ? translate('app.transactions_convert_preview_debit')
          : translate('app.transactions_convert_preview_credit')}
      </Typography>
    </Paper>
  );
}

function SequenceFrameRow({
  frame,
  isLast,
}: {
  frame: MovementSequenceFrame;
  isLast: boolean;
}) {
  const theme = useTheme();
  const translate = useTranslate();
  const accent = frameAccent(theme, frame);
  const amountLabel = formatSequenceAmount(frame.amount, frame.currencyCode);

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'stretch' }}>
      <Stack
        sx={{
          alignItems: 'center',
          width: 40,
          flexShrink: 0,
          pt: 1,
        }}
      >
        <Box
          sx={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            bgcolor: accent,
            boxShadow: `0 0 0 3px ${accent}33`,
          }}
        />
        {!isLast ? (
          <Box
            sx={{
              flex: 1,
              width: 3,
              minHeight: 24,
              mt: 0.5,
              borderRadius: 2,
              bgcolor: `${accent}55`,
            }}
          />
        ) : null}
      </Stack>
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          mb: isLast ? 0 : 2,
          p: 1.5,
          borderLeft: 4,
          borderColor: accent,
          bgcolor: `${accent}0d`,
        }}
        variant="outlined"
      >
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
          <Chip
            label={`${frame.order}. ${translate(kindLabelKey(frame.kind))}${
              frame.kind === 'step' && frame.stepIndex != null
                ? ` #${frame.stepIndex + 1}`
                : ''
            }`}
            size="small"
            sx={{
              bgcolor: accent,
              color: theme.palette.getContrastText(accent),
              fontWeight: 600,
            }}
          />
          {frame.percent != null ? (
            <Chip
              label={`${frame.percent}%`}
              size="small"
              variant="outlined"
            />
          ) : null}
        </Stack>
        {frame.description ? (
          <Typography sx={{ mb: 1.25 }} variant="body2">
            {frame.description}
          </Typography>
        ) : null}
        <Stack
          alignItems="center"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
        >
          <AccountChip account={frame.debit} side="debit" />
          <Stack alignItems="center" spacing={0.25} sx={{ px: 0.5 }}>
            <ArrowForwardIcon color="action" fontSize="small" />
            <Chip
              color={frame.kind === 'storno' ? 'error' : 'default'}
              label={amountLabel}
              size="small"
              sx={{ fontWeight: 700 }}
              variant={frame.kind === 'storno' ? 'filled' : 'outlined'}
            />
          </Stack>
          <AccountChip account={frame.credit} side="credit" />
        </Stack>
      </Paper>
    </Stack>
  );
}

export function ConvertPreviewDiagram({
  preview,
}: {
  preview: ConvertPreview;
}) {
  const translate = useTranslate();
  const frames = buildMovementSequence(preview);

  return (
    <Box sx={{ mt: 1 }}>
      <Typography color="text.secondary" variant="caption">
        {translate('app.transactions_convert_preview_sequence_legend')}
      </Typography>
      <Box
        aria-label={translate('app.transactions_convert_preview_diagram_aria', {
          summary: movementSequenceAriaSummary(preview),
        })}
        role="list"
        sx={{ mt: 1.5 }}
      >
        {frames.map((frame, index) => (
          <Box key={frame.id} role="listitem">
            <SequenceFrameRow
              frame={frame}
              isLast={index === frames.length - 1}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
