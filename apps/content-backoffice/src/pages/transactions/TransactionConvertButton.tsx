import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { Button } from '@mui/material';
import { Fragment, useState } from 'react';
import {
  Confirm,
  useNotify,
  useRefresh,
  useTranslate,
} from 'react-admin';

import { convertTransactionToWorkflow } from '../../data/dataProvider';
import type { WorkflowTemplateHeader } from '../../data/transactionList';
import { strapiErrorMessage } from '../../data/transactionPublish';
import { invalidateTransactionWorkflowCatalog } from '../../workflows/useTransactionWorkflowCatalog';

export function TransactionConvertButton({
  documentId,
  workflow,
  disabled,
  labelKey = 'app.transactions_convert',
}: {
  documentId: string;
  workflow: WorkflowTemplateHeader;
  disabled?: boolean;
  labelKey?: string;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onConfirm = () => {
    if (busy) return;
    setBusy(true);
    void convertTransactionToWorkflow(documentId, workflow.documentId)
      .then(() => {
        notify('app.transactions_convert_done', { type: 'success' });
        setOpen(false);
        refresh();
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
    <Fragment>
      <Button
        disabled={disabled || busy}
        size="small"
        startIcon={<AccountTreeIcon />}
        variant="outlined"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {translate(labelKey)}
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
        onConfirm={onConfirm}
      />
    </Fragment>
  );
}
