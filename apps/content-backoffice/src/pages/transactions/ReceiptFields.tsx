import { Box, Button, Link, TextField, Typography } from '@mui/material';
import { useTranslate } from 'react-admin';

import { STRAPI_URL } from '../../config';
import { receiptDocumentUrl, receiptIsPresent } from '../../data/receiptDraft';

type ReceiptFieldsProps = {
  file: File | null;
  onFile: (file: File | null) => void;
  vendor: string;
  onVendor: (vendor: string) => void;
};

/** Optional receipt block. With no file, the transaction is saved without one. */
export function ReceiptFields({
  file,
  onFile,
  vendor,
  onVendor,
}: ReceiptFieldsProps) {
  const translate = useTranslate();

  return (
    <Box
      component="fieldset"
      sx={{ border: 0, m: 0, mt: 2, p: 0, width: '100%' }}
    >
      <Typography component="legend" variant="subtitle1">
        {translate('app.receipt_block')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1 }} variant="body2">
        {translate('app.receipt_optional')} {translate('app.receipt_prefill')}
      </Typography>
      <Button component="label" size="small" type="button" variant="outlined">
        {translate('app.receipt_file')}
        <input
          hidden
          type="file"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            onFile(next && next.size > 0 ? next : null);
            event.target.value = '';
          }}
        />
      </Button>
      {file ? (
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, mt: 1 }}>
          <Typography variant="body2">{file.name}</Typography>
          <Button size="small" type="button" onClick={() => onFile(null)}>
            {translate('app.receipt_clear')}
          </Button>
        </Box>
      ) : (
        <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
          {translate('app.receipt_skip')}
        </Typography>
      )}
      <TextField
        fullWidth
        helperText={translate('app.receipt_vendor_hint')}
        label={translate('app.receipt_vendor')}
        margin="normal"
        value={vendor}
        onChange={(event) => onVendor(event.target.value)}
      />
    </Box>
  );
}

export function ReceiptLink({ receipt }: { receipt: unknown }) {
  const translate = useTranslate();
  const url = receiptDocumentUrl(receipt, STRAPI_URL);
  if (!receiptIsPresent(receipt)) {
    return <>{translate('app.receipt_no')}</>;
  }
  if (!url) {
    return <>{translate('app.receipt_yes')}</>;
  }
  return (
    <>
      {translate('app.receipt_yes')}
      {' · '}
      <Link
        href={url}
        rel="noopener noreferrer"
        target="_blank"
        onClick={(event) => event.stopPropagation()}
      >
        {translate('app.receipt_open')}
      </Link>
    </>
  );
}
