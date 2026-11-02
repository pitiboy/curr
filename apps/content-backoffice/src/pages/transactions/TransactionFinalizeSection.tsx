import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Button, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useNotify, useRefresh, useTranslate } from 'react-admin';

import {
  publishTransaction,
  saveTransactionDraft,
} from '../../data/dataProvider';
import {
  isSamePersonPublishError,
  strapiErrorMessage,
} from '../../data/transactionPublish';
import { bandedSpanClass } from '../../theme';
import { transactionPublishFormErrors } from './transactionForm';

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
  const { getValues, setError, clearErrors } = useFormContext();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

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
        {missingReceipt ? (
          <Typography sx={{ fontWeight: 600, mb: 1 }} variant="body2">
            {translate('app.transactions_finalize_no_receipt')}
          </Typography>
        ) : null}
        {blocked ? (
          <Typography sx={{ fontWeight: 600, mb: 1 }} variant="body2">
            {translate('app.transactions_finalize_pending')}
          </Typography>
        ) : null}
        {samePersonBlocked ? (
          <Typography sx={{ fontWeight: 600, mb: 1 }} variant="body2">
            {translate('app.transactions_finalize_same_person')}
          </Typography>
        ) : null}
        <Button
          disabled={blocked || samePersonBlocked || saving}
          type="button"
          variant="contained"
          onClick={onFinalize}
        >
          {translate('app.transactions_finalize')}
        </Button>
      </Box>
    </Box>
  );
}
