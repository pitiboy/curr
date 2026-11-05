import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  Confirm,
  useNotify,
  useRedirect,
  useRefresh,
  useTranslate,
} from 'react-admin';

import {
  discardTransaction,
  publishTransaction,
  saveTransactionDraft,
} from '../../data/dataProvider';
import {
  isSamePersonPublishError,
  strapiErrorMessage,
} from '../../data/transactionPublish';
import { bandedSpanClass } from '../../theme';
import {
  collectFinalizeIssues,
  transactionPublishFormErrors,
} from './transactionForm';

const reviewFieldset = {
  border: 0,
  m: 0,
  minWidth: 0,
  p: 0,
} as const;

const reviewLegend = {
  alignItems: 'center',
  display: 'flex',
  gap: 0.5,
  mb: 0.5,
  px: 0,
} as const;

const reviewIcon = { fontSize: 20 } as const;

const issueAccordion = {
  bgcolor: 'warning.50',
  border: 1,
  borderColor: 'warning.light',
  borderRadius: 1,
  boxShadow: 'none',
  mb: 1,
  '&:before': { display: 'none' },
} as const;

const issueSummary = {
  '& .MuiAccordionSummary-content': {
    alignItems: 'center',
    gap: 1,
    my: 1,
  },
} as const;

const issueList = {
  m: 0,
  pl: 2.5,
} as const;

export function TransactionFinalizeSection({
  blocked,
  documentId,
  missingReceipt,
  samePersonBlocked,
}: {
  blocked: boolean;
  documentId: string;
  missingReceipt: boolean;
  samePersonBlocked: boolean;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const { control, getValues, setError, clearErrors } = useFormContext();
  const formValues = useWatch({ control }) as Record<string, unknown>;
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const savingRef = useRef(false);

  const issues = collectFinalizeIssues(
    formValues ?? {},
    { blocked, missingReceipt, samePersonBlocked },
    translate,
  );
  const errorCount = issues.filter((issue) => issue.level === 'error').length;
  const warningCount = issues.filter(
    (issue) => issue.level === 'warning',
  ).length;

  const onFinalize = () => {
    if (blocked || samePersonBlocked || savingRef.current) return;

    const values = getValues() as Record<string, unknown>;
    clearErrors();
    const errors = transactionPublishFormErrors(values, translate);
    for (const [field, message] of Object.entries(errors)) {
      setError(field, { type: 'manual', message });
    }
    if (Object.keys(errors).length > 0) {
      notify('ra.message.invalid_form', { type: 'warning' });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    saveTransactionDraft(documentId, values)
      .then(() => publishTransaction(documentId))
      .then(() => {
        notify('app.transactions_finalized', { type: 'success' });
        refresh();
      })
      .catch((error: unknown) => {
        const message = strapiErrorMessage(error);
        notify(
          isSamePersonPublishError(message)
            ? 'app.transactions_finalize_same_person'
            : message || 'ra.notification.http_error',
          { type: 'error' },
        );
      })
      .finally(() => {
        savingRef.current = false;
        setSaving(false);
      });
  };

  const onDiscardConfirm = () => {
    if (discarding || savingRef.current) return;
    setDiscarding(true);
    void discardTransaction(documentId)
      .then(() => {
        notify('app.transactions_discard_done', { type: 'success' });
        setDiscardOpen(false);
        redirect('list', 'transactions');
      })
      .catch((error: unknown) => {
        const message = strapiErrorMessage(error);
        notify(message || 'app.transactions_discard_error', { type: 'error' });
      })
      .finally(() => setDiscarding(false));
  };

  return (
    <Box className={bandedSpanClass} sx={{ px: 1, pb: 1, pt: 0.5 }}>
      <Box component="fieldset" sx={reviewFieldset}>
        <Box component="legend" sx={reviewLegend}>
          <WarningAmberIcon aria-hidden sx={reviewIcon} />
          <Typography
            component="span"
            sx={{ fontWeight: 700 }}
            variant="subtitle1"
          >
            {translate('app.transactions_review')}
          </Typography>
        </Box>
        <Typography sx={{ mb: 1 }} variant="body2">
          {translate('app.transactions_finalize_hint')}
        </Typography>
        {issues.length > 0 ? (
          <Accordion disableGutters defaultExpanded={false} sx={issueAccordion}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={issueSummary}>
              <WarningAmberIcon aria-hidden color="warning" sx={reviewIcon} />
              <Typography component="span" fontWeight={600} variant="body2">
                {translate('app.transactions_finalize_issues', {
                  errors: errorCount,
                  warnings: warningCount,
                })}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Box component="ul" sx={issueList}>
                {issues.map((issue) => (
                  <Typography
                    key={`${issue.level}:${issue.message}`}
                    component="li"
                    sx={{ mb: 0.5 }}
                    variant="body2"
                  >
                    {issue.message}
                  </Typography>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        ) : null}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button
            disabled={blocked || samePersonBlocked || saving || discarding}
            type="button"
            variant="contained"
            onClick={onFinalize}
          >
            {translate('app.transactions_finalize')}
          </Button>
          <Button
            color="error"
            disabled={saving || discarding}
            type="button"
            variant="outlined"
            onClick={() => setDiscardOpen(true)}
          >
            {translate('app.transactions_discard')}
          </Button>
        </Stack>
      </Box>
      <Confirm
        confirm="app.transactions_discard_confirm"
        content="app.transactions_discard_body"
        isOpen={discardOpen}
        loading={discarding}
        title="app.transactions_discard_title"
        onClose={() => !discarding && setDiscardOpen(false)}
        onConfirm={onDiscardConfirm}
      />
    </Box>
  );
}
