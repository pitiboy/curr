import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  GlobalStyles,
  Stack,
  Typography,
} from '@mui/material';
import { strapiHttpClient } from 'ra-strapi';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslate } from 'react-admin';

import { STRAPI_URL } from '../../config';
import { strapiErrorMessage } from '../../data/transactionPublish';
import {
  mapVoiceParseToForm,
  parseVoiceTranscript,
  VOICE_TRANSACTION_FEATURE_KEY,
  type VoiceFormField,
  type VoiceFormPlan,
} from '../../data/voiceTransaction';
import { bandedSpanClass } from '../../theme';
import { useBackofficeConfig } from '../../workflows/useBackofficeConfig';
import { useOptionalTransactionCreateAccountRow } from './TransactionCreateAccountRowContext';
import { useSpeechRecognition } from './useSpeechRecognition';

const httpClient = strapiHttpClient({ storage: localStorage });

const FIELD_LABEL_KEYS: Record<VoiceFormField, string> = {
  date: 'resources.transactions.fields.date',
  amount: 'resources.transactions.fields.amount',
  currency_type: 'resources.transactions.fields.currency_type',
  organization: 'resources.transactions.fields.organization',
  description: 'resources.transactions.fields.description',
  debit_account: 'resources.transactions.fields.debit_account',
  credit_account: 'resources.transactions.fields.credit_account',
};

/** Outline the inputs the dictation filled (warning colour when unsure). */
function fieldHighlightStyles(plan: VoiceFormPlan | null) {
  if (!plan) return null;
  const low = new Set(plan.lowConfidenceFields);
  const styles: Record<string, Record<string, unknown>> = {};
  for (const field of plan.filledFields) {
    const selector = `form .MuiInputBase-root:has(input[name="${field}"]), form .MuiInputBase-root:has(textarea[name="${field}"]), form .MuiInputBase-root:has(#${field})`;
    styles[selector] = {
      boxShadow: low.has(field)
        ? '0 0 0 2px var(--mui-palette-warning-main, #ed6c02)'
        : '0 0 0 2px var(--mui-palette-success-main, #2e7d32)',
      borderRadius: 4,
    };
  }
  return <GlobalStyles styles={styles} />;
}

/** Feature-flagged wrapper: renders nothing when `voice_transaction_entry` is off. */
export function VoiceTransactionEntry() {
  const config = useBackofficeConfig();
  if (!config.features[VOICE_TRANSACTION_FEATURE_KEY]?.enabled) return null;
  return <VoiceTransactionEntryPanel />;
}

function VoiceTransactionEntryPanel() {
  const translate = useTranslate();
  const { getValues, setValue } = useFormContext();
  const accountRow = useOptionalTransactionCreateAccountRow();
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [plan, setPlan] = useState<VoiceFormPlan | null>(null);
  // Values to apply after the ügylet-sablon prefill; a tick triggers the effect.
  const pendingAfterWorkflowRef = useRef<VoiceFormPlan['afterWorkflow'] | null>(
    null,
  );
  const [workflowTick, setWorkflowTick] = useState(0);

  const write = useCallback(
    (field: string, value: unknown) =>
      setValue(field, value, { shouldDirty: true, shouldValidate: true }),
    [setValue],
  );

  // The ügylet-sablon prefill rewrites accounts/currency in its own effect;
  // run after that commit and only fill what is still empty.
  useEffect(() => {
    const pending = pendingAfterWorkflowRef.current;
    if (!pending) return;
    pendingAfterWorkflowRef.current = null;
    // Not cleared on re-run: the ref is already consumed.
    window.setTimeout(() => {
      for (const [field, value] of Object.entries(pending)) {
        const current = getValues(field);
        if (current === undefined || current === null || current === '') {
          write(field, value);
        }
      }
    }, 0);
  }, [getValues, workflowTick, write]);

  const submitTranscript = useCallback(
    async (transcript: string) => {
      setBusy(true);
      setRequestError(null);
      try {
        const organization = getValues('organization');
        const result = await parseVoiceTranscript(httpClient, STRAPI_URL, {
          transcript,
          organizationId:
            typeof organization === 'string' && organization
              ? organization
              : null,
        });
        const next = mapVoiceParseToForm(result);
        for (const [field, value] of Object.entries(next.immediate)) {
          write(field, value);
        }
        if (next.workflowDocumentId && accountRow) {
          accountRow.setStoredSelection({
            kind: 'workflow',
            workflowDocumentId: next.workflowDocumentId,
          });
          pendingAfterWorkflowRef.current = next.afterWorkflow;
          setWorkflowTick((tick) => tick + 1);
        } else {
          for (const [field, value] of Object.entries(next.afterWorkflow)) {
            write(field, value);
          }
        }
        setPlan(next);
      } catch (error) {
        setRequestError(
          strapiErrorMessage(error) || translate('app.voice_error_request'),
        );
      } finally {
        setBusy(false);
      }
    },
    [accountRow, getValues, translate, write],
  );

  const speech = useSpeechRecognition({ onFinal: submitTranscript });

  if (!speech.supported) {
    return (
      <Box className={bandedSpanClass} sx={{ px: 1, pb: 1 }}>
        <Alert severity="info">{translate('app.voice_unsupported')}</Alert>
      </Box>
    );
  }

  const liveText = [speech.finalText, speech.interim].filter(Boolean).join(' ');

  return (
    <Box className={bandedSpanClass} sx={{ px: 1, pb: 1 }}>
      {fieldHighlightStyles(plan)}
      <Stack spacing={1}>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
        >
          <Button
            color={speech.listening ? 'error' : 'primary'}
            disabled={busy}
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
              {translate('app.voice_hint')}
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
        {requestError ? <Alert severity="error">{requestError}</Alert> : null}

        {plan ? <VoiceResultSummary plan={plan} /> : null}
      </Stack>
    </Box>
  );
}

function VoiceResultSummary({ plan }: { plan: VoiceFormPlan }) {
  const translate = useTranslate();
  const low = new Set(plan.lowConfidenceFields);
  return (
    <Stack spacing={1}>
      <Alert severity="info">{translate('app.voice_review_notice')}</Alert>
      {plan.filledFields.length > 0 ? (
        <Stack
          direction="row"
          sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
        >
          <Typography variant="body2">
            {translate('app.voice_filled_fields')}
          </Typography>
          {plan.filledFields.map((field) => (
            <Chip
              color={low.has(field) ? 'warning' : 'success'}
              key={field}
              label={
                translate(FIELD_LABEL_KEYS[field], { _: field }) +
                (low.has(field)
                  ? ` (${translate('app.voice_low_confidence')})`
                  : '')
              }
              size="small"
              variant="outlined"
            />
          ))}
        </Stack>
      ) : (
        <Alert severity="warning">
          {translate('app.voice_nothing_filled')}
        </Alert>
      )}
      {plan.workflowLabel ? (
        <Typography variant="body2">
          {translate('app.voice_workflow_selected', {
            name: plan.workflowLabel,
          })}
        </Typography>
      ) : null}
      {plan.memberLabel ? (
        <Typography variant="body2">
          {translate('app.voice_member_mentioned', { name: plan.memberLabel })}
        </Typography>
      ) : null}
      {plan.warnings.map((warning) => (
        <Alert key={warning} severity="warning">
          {warning}
        </Alert>
      ))}
    </Stack>
  );
}
