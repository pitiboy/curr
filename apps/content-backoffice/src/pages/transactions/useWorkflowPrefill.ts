import { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import type { AccountChoice } from '../../data/accountCodes';
import {
  findWorkflowByDocumentId,
  resolveWorkflowPrefill,
} from '../../data/accountRowSelection';
import type { WorkflowTemplateHeader } from '../../data/transactionList';

import { useTransactionCreateAccountRow } from './TransactionCreateAccountRowContext';

const HIDDEN_TRANSACTION_TYPE_FIELD = 'transaction_type';

export function useWorkflowPrefillOnSelect(
  accounts: AccountChoice[],
  transactionWorkflows: WorkflowTemplateHeader[],
): {
  prefillWarningKeys: string[];
} {
  const { setValue } = useFormContext();
  const { storedSelection, setPrefillAccountsResolved, resolved } =
    useTransactionCreateAccountRow();
  const appliedWorkflowRef = useRef<string | null>(null);
  const [prefillWarningKeys, setPrefillWarningKeys] = useState<string[]>([]);

  useEffect(() => {
    if (storedSelection.kind !== 'workflow') {
      appliedWorkflowRef.current = null;
      setPrefillWarningKeys([]);
      setValue(HIDDEN_TRANSACTION_TYPE_FIELD, undefined, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setPrefillAccountsResolved(true);
      return;
    }

    if (appliedWorkflowRef.current === storedSelection.workflowDocumentId) {
      return;
    }

    const workflow = findWorkflowByDocumentId(
      transactionWorkflows,
      storedSelection.workflowDocumentId,
    );
    if (!workflow) {
      setPrefillAccountsResolved(false);
      setPrefillWarningKeys([
        'app.account_profile_workflow_prefill_incomplete',
      ]);
      return;
    }

    const prefill = resolveWorkflowPrefill(workflow, accounts);
    setPrefillWarningKeys(prefill.warningKeys);
    setPrefillAccountsResolved(prefill.accountsResolved);
    appliedWorkflowRef.current = storedSelection.workflowDocumentId;

    if (prefill.debitAccountId) {
      setValue('debit_account', prefill.debitAccountId, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (prefill.creditAccountId) {
      setValue('credit_account', prefill.creditAccountId, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (prefill.currencyTypeId) {
      setValue('currency_type', prefill.currencyTypeId, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (prefill.transactionTypeId) {
      setValue(HIDDEN_TRANSACTION_TYPE_FIELD, prefill.transactionTypeId, {
        shouldDirty: true,
        shouldValidate: false,
      });
    } else {
      setValue(HIDDEN_TRANSACTION_TYPE_FIELD, undefined, {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }, [
    accounts,
    setPrefillAccountsResolved,
    setValue,
    storedSelection,
    transactionWorkflows,
  ]);

  useEffect(() => {
    if (!resolved.workflowDropped) return;
    setValue(HIDDEN_TRANSACTION_TYPE_FIELD, undefined, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setPrefillAccountsResolved(true);
    appliedWorkflowRef.current = null;
    setPrefillWarningKeys([]);
  }, [resolved.workflowDropped, setPrefillAccountsResolved, setValue]);

  return { prefillWarningKeys };
}
