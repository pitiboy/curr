import { Box } from '@mui/material';

import {
  isExpandableConvertedValue,
  transactionLikeFromRecord,
  type TransactionRow,
} from '../../data/transactionList';
import { useTransactionWorkflowCatalog } from '../../workflows/useTransactionWorkflowCatalog';
import { TransactionConvertButton } from './TransactionConvertButton';
import { bandedSpanClass } from '../../theme';

export function TransactionConvertSection({
  record,
}: {
  record: TransactionRow;
}) {
  const { matchFor, loading: catalogLoading } = useTransactionWorkflowCatalog();

  if (!isExpandableConvertedValue(record.converted_to_workflow)) return null;

  const workflow = catalogLoading
    ? null
    : matchFor(transactionLikeFromRecord(record));
  if (!workflow) return null;

  return (
    <Box className={bandedSpanClass} sx={{ px: 1, pb: 1, pt: 0.5 }}>
      <TransactionConvertButton
        documentId={record.documentId}
        workflow={workflow}
      />
    </Box>
  );
}
