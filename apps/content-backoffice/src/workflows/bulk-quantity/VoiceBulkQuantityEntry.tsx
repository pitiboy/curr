import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { strapiHttpClient } from 'ra-strapi';
import { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslate } from 'react-admin';

import { STRAPI_URL } from '../../config';
import { strapiErrorMessage } from '../../data/transactionPublish';
import { useSpeechRecognition } from '../../pages/transactions/useSpeechRecognition';
import { bandedSpanClass } from '../../theme';
import { useBackofficeConfig } from '../useBackofficeConfig';
import {
  mapVoiceEggParseToBulk,
  parseVoiceEggTranscript,
  VOICE_TRANSACTION_FEATURE_KEY,
  type VoiceEggBulkFormPlan,
} from './voiceBulkQuantity';
import type { BulkQuantityVoiceConfig } from './types';

const httpClient = strapiHttpClient({ storage: localStorage });

export type VoiceBulkQuantityEntryProps = {
  voice: BulkQuantityVoiceConfig;
  workflowId: string;
  organizationId: string | null;
  disabled?: boolean;
  onApplied: (plan: VoiceEggBulkFormPlan) => void;
};

/** Feature-flagged microphone for bulk egg entry (parse-voice + workflowId). */
export function VoiceBulkQuantityEntry({
  voice,
  workflowId,
  organizationId,
  disabled = false,
  onApplied,
}: VoiceBulkQuantityEntryProps) {
  const config = useBackofficeConfig();
  const featureKey = voice.featureKey ?? VOICE_TRANSACTION_FEATURE_KEY;
  if (!config.features[featureKey]?.enabled) return null;
  return (
    <VoiceBulkQuantityEntryPanel
      disabled={disabled}
      organizationId={organizationId}
      workflowId={workflowId}
      onApplied={onApplied}
    />
  );
}

function VoiceBulkQuantityEntryPanel({
  workflowId,
  organizationId,
  disabled,
  onApplied,
}: {
  workflowId: string;
  organizationId: string | null;
  disabled: boolean;
  onApplied: (plan: VoiceEggBulkFormPlan) => void;
}) {
  const translate = useTranslate();
  const { setValue } = useFormContext();
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [plan, setPlan] = useState<VoiceEggBulkFormPlan | null>(null);

  const submitTranscript = useCallback(
    async (transcript: string) => {
      const text = transcript.trim();
      if (!text) return;
      setLastTranscript(text);
      setBusy(true);
      setRequestError(null);
      try {
        const result = await parseVoiceEggTranscript(httpClient, STRAPI_URL, {
          transcript: text,
          organizationId,
          workflowId,
        });
        const next = mapVoiceEggParseToBulk(result);
        if (next.date) {
          setValue('date', next.date, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
        onApplied(next);
        setPlan(next);
      } catch (error) {
        setRequestError(
          strapiErrorMessage(error) || translate('app.voice_error_request'),
        );
      } finally {
        setBusy(false);
      }
    },
    [onApplied, organizationId, setValue, translate, workflowId],
  );

  const retryParse = useCallback(() => {
    if (!lastTranscript || busy) return;
    void submitTranscript(lastTranscript);
  }, [busy, lastTranscript, submitTranscript]);

  const speech = useSpeechRecognition({ onFinal: submitTranscript });

  if (!speech.supported) {
    return (
      <Box className={bandedSpanClass} sx={{ px: 1, pb: 1 }}>
        <Alert severity="info">{translate('app.voice_unsupported')}</Alert>
      </Box>
    );
  }

  const liveText = [speech.finalText, speech.interim].filter(Boolean).join(' ');
  const nothingFilled =
    plan &&
    !plan.date &&
    plan.filledProductionIds.length === 0 &&
    plan.filledDistributionIds.length === 0;

  return (
    <Box className={bandedSpanClass} sx={{ px: 1, pb: 1, width: '100%' }}>
      <Stack spacing={1}>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
        >
          <Button
            color={speech.listening ? 'error' : 'primary'}
            disabled={busy || disabled}
            onClick={speech.listening ? speech.stop : speech.start}
            startIcon={speech.listening ? <StopIcon /> : <MicIcon />}
            variant={speech.listening ? 'contained' : 'outlined'}
          >
            {translate(speech.listening ? 'app.voice_stop' : 'app.voice_start')}
          </Button>
          {busy ? (
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
              <CircularProgress size={18} />
              <Typography variant="body2">
                {translate('app.voice_processing')}
              </Typography>
            </Stack>
          ) : (
            <Typography color="text.secondary" variant="body2">
              {translate('app.voice_bulk_hint')}
            </Typography>
          )}
        </Stack>

        {speech.listening || liveText ? (
          <Typography
            aria-live="polite"
            sx={{ fontStyle: speech.interim ? 'italic' : 'normal' }}
            variant="body2"
          >
            {liveText || translate('app.voice_listening')}
          </Typography>
        ) : null}

        {speech.errorKey ? (
          <Alert severity="warning">{translate(speech.errorKey)}</Alert>
        ) : null}
        {requestError ? (
          <Alert
            action={
              lastTranscript ? (
                <Button
                  color="inherit"
                  disabled={busy}
                  onClick={retryParse}
                  size="small"
                >
                  {translate('app.voice_retry')}
                </Button>
              ) : null
            }
            severity="error"
          >
            {requestError}
          </Alert>
        ) : null}

        {plan ? (
          <Stack spacing={1}>
            <Alert severity="info">
              {translate('app.voice_review_notice')}
            </Alert>
            {nothingFilled ? (
              <Alert severity="warning">
                {translate('app.voice_nothing_filled')}
              </Alert>
            ) : null}
            {plan.warnings.map((warning) => (
              <Alert key={warning} severity="warning">
                {warning}
              </Alert>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
