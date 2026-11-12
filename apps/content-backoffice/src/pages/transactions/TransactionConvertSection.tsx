import { Alert } from '@mui/material';
import { useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslate } from 'react-admin';

import { matchInputForConvert } from '../../data/accountRowSelection';
import {
  countMatchingWorkflows,
  isExpandableConvertedValue,
  type TransactionRow,
} from '../../data/transactionList';
import { useTransactionWorkflowCatalog } from '../../workflows/useTransactionWorkflowCatalog';
import { TransactionConvertButton } from './TransactionConvertButton';
import { useAccountCatalog } from './useAccountCatalog';

/**
 * Convert CTA(s) for the review action row (next to Véglegesít), matching
 * Create toolbar placement. Renders nothing when no unique template matches.
 */
export function TransactionConvertSection({
  record,
  disabled = false,
}: {
  record: TransactionRow;
  disabled?: boolean;
}) {
  const translate = useTranslate();
  const { accounts } = useAccountCatalog();
  const {
    matchFor,
    loading: catalogLoading,
    workflows,
  } = useTransactionWorkflowCatalog();
  const debitId = useWatch({ name: 'debit_account' });
  const creditId = useWatch({ name: 'credit_account' });
  const currencyId = useWatch({ name: 'currency_type' });
  const transactionTypeId = useWatch({ name: 'transaction_type' });

  const transactionLike = useMemo(
    () =>
      matchInputForConvert(record, accounts, {
        debitAccountDocumentId: debitId,
        creditAccountDocumentId: creditId,
        currencyTypeDocumentId: currencyId,
        transactionTypeDocumentId: transactionTypeId,
      }),
    [accounts, creditId, currencyId, debitId, record, transactionTypeId],
  );

  if (!isExpandableConvertedValue(record.converted_to_workflow)) return null;

  const matchCount = catalogLoading
    ? 0
    : countMatchingWorkflows(workflows, transactionLike);
  const workflow = catalogLoading ? null : matchFor(transactionLike);

  if (matchCount > 1) {
    return (
      <Alert severity="warning" sx={{ py: 0 }} variant="outlined">
        {translate('app.transactions_convert_ambiguous')}
      </Alert>
    );
  }

  if (!workflow) return null;

  return (
    <TransactionConvertButton
      disabled={disabled}
      documentId={record.documentId}
      workflow={workflow}
    />
  );
}
