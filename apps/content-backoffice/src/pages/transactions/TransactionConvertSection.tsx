import { Alert, Box } from '@mui/material';
import { useTranslate } from 'react-admin';

import {
  countMatchingWorkflows,
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
  const translate = useTranslate();
  const {
    matchFor,
    loading: catalogLoading,
    workflows,
  } = useTransactionWorkflowCatalog();

  if (!isExpandableConvertedValue(record.converted_to_workflow)) return null;

  const transactionLike = transactionLikeFromRecord(record);
  const matchCount = catalogLoading
    ? 0
    : countMatchingWorkflows(workflows, transactionLike);
  const workflow = catalogLoading ? null : matchFor(transactionLike);

  if (matchCount > 1) {
    return (
      <Box className={bandedSpanClass} sx={{ px: 1, pb: 1, pt: 0.5 }}>
        <Alert severity="warning" variant="outlined">
          {translate('app.transactions_convert_ambiguous')}
        </Alert>
      </Box>
    );
  }

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
