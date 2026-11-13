import { Box, Button, Stack } from '@mui/material';
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
import type { TransactionRow } from '../../data/transactionList';
import { bandedSpanClass } from '../../theme';
import { FormIssueAccordion } from './FormIssueAccordion';
import { collectFinalizeIssues } from './formIssues';
import { transactionPublishFormErrors } from './transactionForm';
import { TransactionConvertSection } from './TransactionConvertSection';

export function TransactionFinalizeSection({
  allowLeaveRef,
  blocked,
  documentId,
  missingReceipt,
  record,
  samePersonBlocked,
}: {
  allowLeaveRef: { current: boolean };
  blocked: boolean;
  documentId: string;
  missingReceipt: boolean;
  /** When set, Convert CTAs sit in the same row as Véglegesít (Create-like). */
  record?: TransactionRow;
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
        allowLeaveRef.current = true;
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
      <FormIssueAccordion
        hint={translate('app.transactions_finalize_hint')}
        issues={issues}
        title={translate('app.transactions_review')}
      />
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
      >
        <Button
          disabled={blocked || samePersonBlocked || saving || discarding}
          type="button"
          variant="contained"
          onClick={onFinalize}
        >
          {translate('app.transactions_finalize')}
        </Button>
        {record ? (
          <TransactionConvertSection
            disabled={saving || discarding}
            record={record}
          />
        ) : null}
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
