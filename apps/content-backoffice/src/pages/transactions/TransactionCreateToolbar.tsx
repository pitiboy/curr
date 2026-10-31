import { Button, Toolbar } from '@mui/material';
import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import {
  Confirm,
  SaveButton,
  useNotify,
  usePermissions,
  useRedirect,
  useTranslate,
} from 'react-admin';

import type { AccountChoice } from '../../data/accountCodes';
import {
  createNewTransactionDraft,
  convertTransactionToWorkflow,
} from '../../data/dataProvider';
import { strapiErrorMessage } from '../../data/transactionPublish';
import { useTransactionWorkflowCatalog } from '../../workflows/useTransactionWorkflowCatalog';
import type { ReceiptCardValue } from './ReceiptFields';
import { transactionFormErrors } from './transactionForm';

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
  const { matchFor } = useTransactionWorkflowCatalog();
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

  const workflow =
    !isPending && permissions === 'editor' ? matchFor(matchInput) : null;

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
        // Bypass leave guard before list redirect (custom create, not SaveButton).
        onSaveSucceeded();
        redirect('list', 'transactions');
      })
      .catch((error: unknown) => {
        const message = strapiErrorMessage(error);
        notify(message || translate('app.transactions_convert_error'), {
          type: 'error',
        });
      })
      .finally(() => setBusy(false));
  };

  return (
    <Toolbar>
      <SaveButton disabled={busy} />
      {workflow ? (
        <>
          <Button
            disabled={busy}
            variant="contained"
            onClick={() => setOpen(true)}
          >
            {translate('app.transactions_convert_save')}
          </Button>
          <Confirm
            confirm={translate('app.transactions_convert_confirm')}
            content={translate('app.transactions_convert_body')}
            isOpen={open}
            loading={busy}
            title={translate('app.transactions_convert_title', {
              name: workflow.name ?? workflow.documentId,
            })}
            onClose={() => !busy && setOpen(false)}
            onConfirm={onSaveAndConvert}
          />
        </>
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
