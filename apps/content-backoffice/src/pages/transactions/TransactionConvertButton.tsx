import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { Button } from '@mui/material';
import { Fragment, useState } from 'react';
import { Confirm, useNotify, useRefresh, useTranslate } from 'react-admin';

import { convertTransactionToWorkflow } from '../../data/dataProvider';
import type {
  TransactionRow,
  WorkflowTemplate,
} from '../../data/transactionList';
import { strapiErrorMessage } from '../../data/transactionPublish';

/**
 * Ügylet kifejtése on a stored transaction. The caller decides visibility
 * (editor, unique template match, not converted). The click asks first: the
 * Convert creates a storno and several step rows.
 */
export function TransactionConvertButton({
  size,
  transaction,
  variant = 'outlined',
  workflow,
}: {
  size?: 'small' | 'medium';
  transaction: Pick<TransactionRow, 'documentId'>;
  variant?: 'outlined' | 'contained';
  workflow: WorkflowTemplate;
}) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onConfirm = () => {
    if (busy) return;
    setBusy(true);
    convertTransactionToWorkflow({
      transactionDocumentId: transaction.documentId,
      workflowDocumentId: workflow.documentId,
    })
      .then(() => {
        setOpen(false);
        notify('app.transactions_convert_done', { type: 'success' });
        refresh();
      })
      .catch((error: unknown) => {
        setOpen(false);
        notify(strapiErrorMessage(error) || 'app.transactions_convert_error', {
          type: 'error',
        });
      })
      .finally(() => setBusy(false));
  };

  return (
    <Fragment>
      <Button
        disabled={busy}
        size={size}
        startIcon={<AccountTreeIcon />}
        type="button"
        variant={variant}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {translate('app.transactions_convert')}
      </Button>
      <Confirm
        confirm="app.transactions_convert_confirm"
        content="app.transactions_convert_body"
        isOpen={open}
        loading={busy}
        title="app.transactions_convert_title"
        titleTranslateOptions={{ name: workflow.name ?? '' }}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
      />
    </Fragment>
  );
}
