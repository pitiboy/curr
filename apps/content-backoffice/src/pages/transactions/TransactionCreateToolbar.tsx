import { Alert, Button, Stack, Toolbar } from '@mui/material';
import { Suspense, lazy, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import {
  SaveButton,
  useNotify,
  usePermissions,
  useRedirect,
  useTranslate,
} from 'react-admin';

import type { AccountChoice } from '../../data/accountCodes';
import type { ConvertPreviewRequest } from '../../data/convertPreview';
import {
  createNewTransactionDraft,
  convertTransactionToWorkflow,
} from '../../data/dataProvider';
import { countMatchingWorkflows } from '../../data/transactionList';
import { strapiErrorMessage } from '../../data/transactionPublish';
import {
  invalidateTransactionWorkflowCatalog,
  useTransactionWorkflowCatalog,
} from '../../workflows/useTransactionWorkflowCatalog';
import type { ReceiptCardValue } from './ReceiptFields';
import { inlinePreviewFromCreateForm } from './convertPreviewInput';
import { transactionFormErrors } from './transactionForm';
import { TransactionConvertPreviewButton } from './TransactionConvertPreviewButton';

const ConvertConfirmDialog = lazy(() =>
  import('./ConvertConfirmDialog').then((module) => ({
    default: module.ConvertConfirmDialog,
  })),
);

/** ReferenceInput stores account documentId; match uses ledger codes from the catalog. */
function accountCodeByDocumentId(
  accounts: AccountChoice[],
  documentId: unknown,
): string | null {
  if (typeof documentId !== 'string' || !documentId.trim()) return null;
  const row = accounts.find((account) => String(account.id) === documentId);
  const code = row?.code;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
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
  const { permissions, isPending } = usePermissions();
  const {
    matchFor,
    workflows,
    loading: catalogLoading,
  } = useTransactionWorkflowCatalog();
  const debitId = useWatch({ name: 'debit_account' });
  const creditId = useWatch({ name: 'credit_account' });
  const currencyId = useWatch({ name: 'currency_type' });
  const values = useWatch();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const matchInput = useMemo(
    () => ({
      debit_account: { code: accountCodeByDocumentId(accounts, debitId) },
      credit_account: { code: accountCodeByDocumentId(accounts, creditId) },
      currency_type:
        typeof currencyId === 'string' && currencyId
          ? { documentId: currencyId }
          : null,
    }),
    [accounts, creditId, currencyId, debitId],
  );

  const matchCount =
    !catalogLoading && !isPending && permissions === 'editor'
      ? countMatchingWorkflows(workflows, matchInput)
      : 0;
  const workflow =
    !isPending && permissions === 'editor' ? matchFor(matchInput) : null;

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

  const onSaveAndConvert = () => {
    if (!workflow || busy) return;
    const formValues = (values ?? {}) as Record<string, unknown>;
    const errors = transactionFormErrors(formValues, receiptCards, translate);
    if (Object.keys(errors).length > 0) {
      notify('ra.message.invalid_form', { type: 'warning' });
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
        }
        notify(message || translate('app.transactions_convert_error'), {
          type: 'error',
        });
      })
      .finally(() => setBusy(false));
  };

  return (
    <Toolbar>
      <SaveButton disabled={busy} />
      {matchCount > 1 ? (
        <Alert severity="warning" sx={{ ml: 1, py: 0 }} variant="outlined">
          {translate('app.transactions_convert_ambiguous')}
        </Alert>
      ) : null}
      {workflow ? (
        <Stack direction="row" spacing={1} sx={{ ml: 1 }}>
          <TransactionConvertPreviewButton
            disabled={!previewInput}
            disabledReasonKey="app.transactions_convert_preview_disabled"
            previewInput={previewInput}
            workflow={workflow}
          />
          <Button
            disabled={busy}
            variant="contained"
            onClick={() => setOpen(true)}
          >
            {translate('app.transactions_convert_save')}
          </Button>
          {open ? (
            <Suspense fallback={null}>
              <ConvertConfirmDialog
                confirmLabelKey="app.transactions_convert_save"
                loading={busy}
                open={open}
                previewInput={previewInput}
                workflow={workflow}
                onClose={() => !busy && setOpen(false)}
                onConfirm={onSaveAndConvert}
              />
            </Suspense>
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
      <SaveButton />
    </Toolbar>
  );
}
