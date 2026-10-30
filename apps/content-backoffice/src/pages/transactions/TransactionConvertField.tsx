import { usePermissions, useRecordContext, type RaRecord } from 'react-admin';

import {
  transactionLikeFromRecord,
  type TransactionRow,
} from '../../data/transactionList';
import { useTransactionWorkflowCatalog } from '../../workflows/useTransactionWorkflowCatalog';
import { TransactionConvertButton } from './TransactionConvertButton';

export function TransactionConvertField(_props: {
  label?: false;
  sortable?: false;
  source?: string;
}) {
  const record = useRecordContext<RaRecord & TransactionRow>();
  const { permissions, isPending } = usePermissions();
  const { matchFor, loading: catalogLoading } = useTransactionWorkflowCatalog();

  if (!record || isPending || permissions !== 'editor') return null;
  if (record.converted_to_workflow === true) return null;

  const workflow = catalogLoading
    ? null
    : matchFor(transactionLikeFromRecord(record));
  if (!workflow) return null;

  return (
    <TransactionConvertButton
      documentId={String(record.documentId)}
      workflow={workflow}
    />
  );
}
