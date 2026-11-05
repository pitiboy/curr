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

export type WorkflowAccountCodeFilters = {
  debit: string | null;
  credit: string | null;
};

const EMPTY_CODE_FILTERS: WorkflowAccountCodeFilters = {
  debit: null,
  credit: null,
};

export function useWorkflowPrefillOnSelect(
  accounts: AccountChoice[],
  transactionWorkflows: WorkflowTemplateHeader[],
): {
  prefillWarningKeys: string[];
  accountCodeFilters: WorkflowAccountCodeFilters;
} {
  const { setValue } = useFormContext();
  const { storedSelection, setPrefillAccountsResolved, resolved } =
    useTransactionCreateAccountRow();
  const appliedWorkflowRef = useRef<string | null>(null);
  const [prefillWarningKeys, setPrefillWarningKeys] = useState<string[]>([]);
  const [accountCodeFilters, setAccountCodeFilters] =
    useState<WorkflowAccountCodeFilters>(EMPTY_CODE_FILTERS);

  useEffect(() => {
    if (storedSelection.kind !== 'workflow') {
      appliedWorkflowRef.current = null;
      setPrefillWarningKeys([]);
      setAccountCodeFilters(EMPTY_CODE_FILTERS);
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
      setAccountCodeFilters(EMPTY_CODE_FILTERS);
      setPrefillWarningKeys([
        'app.account_profile_workflow_prefill_incomplete',
      ]);
      return;
    }

    const prefill = resolveWorkflowPrefill(workflow, accounts);
    setPrefillWarningKeys(prefill.warningKeys);
    setAccountCodeFilters({
      debit: prefill.debitAccountCodeFilter,
      credit: prefill.creditAccountCodeFilter,
    });
    setPrefillAccountsResolved(prefill.accountsResolved);
    appliedWorkflowRef.current = storedSelection.workflowDocumentId;

    // Always write both sides: unique codes fill, ambiguous/missing clear the
    // previous selection so stale accounts cannot silently keep the wrong row.
    setValue('debit_account', prefill.debitAccountId ?? '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue('credit_account', prefill.creditAccountId ?? '', {
      shouldDirty: true,
      shouldValidate: true,
    });
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
    setAccountCodeFilters(EMPTY_CODE_FILTERS);
  }, [resolved.workflowDropped, setPrefillAccountsResolved, setValue]);

  return { prefillWarningKeys, accountCodeFilters };
}
