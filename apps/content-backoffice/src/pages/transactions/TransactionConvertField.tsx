import { Stack } from '@mui/material';
import { useMemo } from 'react';
import { usePermissions, useRecordContext, type RaRecord } from 'react-admin';

import type { ConvertPreviewRequest } from '../../data/convertPreview';
import {
  isExpandableConvertedValue,
  transactionLikeFromRecord,
  type TransactionRow,
} from '../../data/transactionList';
import { useTransactionWorkflowCatalog } from '../../workflows/useTransactionWorkflowCatalog';
import { TransactionConvertButton } from './TransactionConvertButton';
import { TransactionConvertPreviewButton } from './TransactionConvertPreviewButton';

export function TransactionConvertField(_props: {
  label?: false;
  sortable?: false;
  source?: string;
}) {
  const record = useRecordContext<RaRecord & TransactionRow>();
  const { permissions, isPending } = usePermissions();
  const { matchFor, loading: catalogLoading } = useTransactionWorkflowCatalog();

  const workflow = useMemo(() => {
    if (!record || catalogLoading) return null;
    return matchFor(transactionLikeFromRecord(record));
  }, [catalogLoading, matchFor, record]);

  const previewInput = useMemo<ConvertPreviewRequest | null>(() => {
    if (!record || !workflow) return null;
    return {
      workflowDocumentId: workflow.documentId,
      transactionDocumentId: String(record.documentId),
    };
  }, [record, workflow]);

  if (!record || isPending || permissions !== 'editor') return null;
  if (!isExpandableConvertedValue(record.converted_to_workflow)) return null;
  if (!workflow || !previewInput) return null;

  return (
    <Stack direction="row" spacing={0.5}>
      <TransactionConvertPreviewButton
        iconOnly
        previewInput={previewInput}
        size="small"
        workflow={workflow}
      />
      <TransactionConvertButton
        documentId={String(record.documentId)}
        showPreview={false}
        workflow={workflow}
      />
    </Stack>
  );
}
