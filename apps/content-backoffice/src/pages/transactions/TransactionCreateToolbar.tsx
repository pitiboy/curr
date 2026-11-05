import { Alert, Button, Stack, Toolbar } from '@mui/material';
import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import {
  SaveButton,
  useNotify,
  usePermissions,
  useRedirect,
  useTranslate,
} from 'react-admin';

import {
  buildTransactionWorkflowMatchInput,
  profileModeMatchCount,
  resolveCreateWorkflow,
} from '../../data/accountRowSelection';
import type { AccountChoice } from '../../data/accountCodes';
import type { ConvertPreviewRequest } from '../../data/convertPreview';
import {
  createNewTransactionDraft,
  convertTransactionToWorkflow,
} from '../../data/dataProvider';
import { strapiErrorMessage } from '../../data/transactionPublish';
import {
  invalidateTransactionWorkflowCatalog,
  useTransactionWorkflowCatalog,
} from '../../workflows/useTransactionWorkflowCatalog';
import type { ReceiptCardValue } from './ReceiptFields';
import { ConvertConfirmDialog } from './ConvertConfirmDialog';
import { inlinePreviewFromCreateForm } from './convertPreviewInput';
import {
  isTransactionCreateFormReady,
  transactionFormErrors,
} from './transactionForm';
import { TransactionConvertPreviewButton } from './TransactionConvertPreviewButton';
import { useOptionalTransactionCreateAccountRow } from './TransactionCreateAccountRowContext';

function useCreateFormReady(
  receiptCards: ReceiptCardValue[],
  requireOrganization: boolean,
): boolean {
  const translate = useTranslate();
  const values = useWatch();
  return useMemo(
    () =>
      isTransactionCreateFormReady(
        (values ?? {}) as Record<string, unknown>,
        receiptCards,
        translate,
        { requireOrganization },
      ),
    [receiptCards, requireOrganization, translate, values],
  );
}

function organizationValueMissing(value: unknown): boolean {
  if (value == null || value === '') return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

export function TransactionCreateToolbar({
  accounts,
  onSaveSucceeded,
  receiptCards,
}: {
  accounts: AccountChoice[];
  onSaveSucceeded: () => void;
  receiptCards: ReceiptCardValue[];
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const redirect = useRedirect();
  const { isPending } = usePermissions();
  const accountRow = useOptionalTransactionCreateAccountRow();
  const { workflows, loading: catalogLoading } =
    useTransactionWorkflowCatalog();
  const debitId = useWatch({ name: 'debit_account' });
  const creditId = useWatch({ name: 'credit_account' });
  const currencyId = useWatch({ name: 'currency_type' });
  const transactionTypeId = useWatch({ name: 'transaction_type' });
  const organizationId = useWatch({ name: 'organization' });
  const values = useWatch();
  const requireOrganizationForSave =
    accountRow?.resolved.activeWorkflow?.requires_source_organization === true;
  const formReady = useCreateFormReady(
    receiptCards,
    requireOrganizationForSave,
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const matchInput = useMemo(
    () =>
      buildTransactionWorkflowMatchInput({
        accounts,
        debitAccountDocumentId: debitId,
        creditAccountDocumentId: creditId,
        currencyTypeDocumentId: currencyId,
        transactionTypeDocumentId: transactionTypeId,
      }),
    [accounts, creditId, currencyId, debitId, transactionTypeId],
  );

  const createWorkflowResolution = useMemo(
    () =>
      resolveCreateWorkflow({
        activeWorkflow: accountRow?.resolved.activeWorkflow ?? null,
        workflows,
        matchInput,
      }),
    [accountRow?.resolved.activeWorkflow, matchInput, workflows],
  );

  const workflow = !isPending ? createWorkflowResolution.workflow : null;

  const matchCount =
    !catalogLoading && !isPending
      ? profileModeMatchCount(workflows, matchInput)
      : 0;

  const showAmbiguityAlert =
    !catalogLoading &&
    !isPending &&
    !accountRow?.resolved.activeWorkflow &&
    matchCount > 1;

  const inlineTransaction = useMemo(
    () =>
      inlinePreviewFromCreateForm(
        (values ?? {}) as Record<string, unknown>,
        receiptCards,
      ),
    [receiptCards, values],
  );

  const previewInput = useMemo<ConvertPreviewRequest | null>(() => {
    if (!workflow || !inlineTransaction) return null;
    return {
      workflowDocumentId: workflow.documentId,
      transaction: inlineTransaction,
    };
  }, [inlineTransaction, workflow]);

  const requireOrganizationForConvert =
    workflow?.requires_source_organization === true;
  const convertNeedsOrganization =
    requireOrganizationForConvert &&
    organizationValueMissing(organizationId);

  const onSaveAndConvert = () => {
    if (!workflow || busy) return;
    const formValues = (values ?? {}) as Record<string, unknown>;
    const errors = transactionFormErrors(formValues, receiptCards, translate, {
      requireOrganization:
        requireOrganizationForSave || requireOrganizationForConvert,
    });
    if (Object.keys(errors).length > 0) {
      notify(
        convertNeedsOrganization
          ? 'app.transactions_convert_organization_required'
          : 'ra.message.invalid_form',
        { type: 'warning' },
      );
      return;
    }
    setBusy(true);
    void createNewTransactionDraft({
      ...formValues,
      receipt_cards: receiptCards,
    })
      .then((result) => {
        const documentId =
          typeof result.data.documentId === 'string'
            ? result.data.documentId
            : '';
        if (!documentId) {
          throw new Error('Missing documentId after create');
        }
        return convertTransactionToWorkflow(documentId, workflow.documentId);
      })
      .then(() => {
        notify('app.transactions_convert_done', { type: 'success' });
        setOpen(false);
        onSaveSucceeded();
        redirect('list', 'transactions');
      })
      .catch((error: unknown) => {
        const message = strapiErrorMessage(error);
        if (message.includes('transaction-workflow not found')) {
          invalidateTransactionWorkflowCatalog();
          accountRow?.resetToProfileAfterStaleWorkflow();
        }
        notify(message || translate('app.transactions_convert_error'), {
          type: 'error',
        });
      })
      .finally(() => setBusy(false));
  };

  const actionsDisabled = busy || !formReady;
  const convertDisabled = actionsDisabled || convertNeedsOrganization;

  return (
    <Toolbar>
      <SaveButton disabled={actionsDisabled} />
      {showAmbiguityAlert ? (
        <Alert severity="warning" sx={{ ml: 1, py: 0 }} variant="outlined">
          {translate('app.transactions_convert_ambiguous')}
        </Alert>
      ) : null}
      {workflow ? (
        <Stack direction="row" spacing={1} sx={{ ml: 1 }}>
          <TransactionConvertPreviewButton
            disabled={!previewInput || convertDisabled}
            disabledReasonKey={
              convertNeedsOrganization
                ? 'app.transactions_convert_organization_required'
                : 'app.transactions_convert_preview_disabled'
            }
            previewInput={previewInput}
            workflow={workflow}
          />
          <Button
            disabled={convertDisabled}
            variant="contained"
            onClick={() => {
              if (convertDisabled) return;
              setOpen(true);
            }}
          >
            {translate('app.transactions_convert_save')}
          </Button>
          {open ? (
            <ConvertConfirmDialog
              confirmLabelKey="app.transactions_convert_save"
              loading={busy}
              open={open}
              previewInput={previewInput}
              workflow={workflow}
              onClose={() => !busy && setOpen(false)}
              onConfirm={onSaveAndConvert}
            />
          ) : null}
        </Stack>
      ) : null}
    </Toolbar>
  );
}

export function TransactionCreateToolbarGate({
  accounts,
  onSaveSucceeded,
  receiptCards,
}: {
  accounts: AccountChoice[];
  onSaveSucceeded: () => void;
  receiptCards: ReceiptCardValue[];
}) {
  const { permissions, isPending } = usePermissions();
  const accountRow = useOptionalTransactionCreateAccountRow();
  const requireOrganization =
    accountRow?.resolved.activeWorkflow?.requires_source_organization === true;
  const formReady = useCreateFormReady(receiptCards, requireOrganization);
  if (!isPending && permissions === 'editor') {
    return (
      <TransactionCreateToolbar
        accounts={accounts}
        onSaveSucceeded={onSaveSucceeded}
        receiptCards={receiptCards}
      />
    );
  }
  return (
    <Toolbar>
      <SaveButton disabled={!formReady} />
    </Toolbar>
  );
}
