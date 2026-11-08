import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTranslate } from 'react-admin';

import {
  appliedRateLabelParts,
  type ConvertPreview,
  type PreviewMovement,
} from '../../data/convertPreview';

function formatAmount(value: number): string {
  return value.toLocaleString('hu-HU', { maximumFractionDigits: 2 });
}

function accountLabel(code: string, name: string | null): string {
  return name ? `${code} — ${name}` : code;
}

function currencyLabel(code: string | null, name: string | null): string {
  const trimmedCode = code?.trim();
  if (trimmedCode) return trimmedCode;
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;
  return '—';
}

function RateCaption({ movement }: { movement: PreviewMovement }) {
  const translate = useTranslate();
  const parts = appliedRateLabelParts(movement.rate);
  if (!parts) return null;
  return (
    <Typography
      color="text.secondary"
      component="div"
      data-testid="convert-preview-rate"
      variant="caption"
    >
      {parts.validFrom
        ? translate('app.transactions_convert_preview_rate', {
            rate: parts.rate,
            validFrom: parts.validFrom,
          })
        : translate('app.transactions_convert_preview_rate_same', {
            rate: parts.rate,
          })}
    </Typography>
  );
}

export function ConvertPreviewTable({ preview }: { preview: ConvertPreview }) {
  const translate = useTranslate();
  const stepTotal = preview.movements
    .filter((row) => row.kind === 'step')
    .reduce((sum, row) => sum + row.amount, 0);

  return (
    <>
      <Table size="small" sx={{ mt: 1 }}>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_kind')}
            </TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_description')}
            </TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_credit')}
            </TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_debit')}
            </TableCell>
            <TableCell align="right">
              {translate('app.transactions_convert_preview_amount')}
            </TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_currency')}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>—</TableCell>
            <TableCell>
              {translate('app.transactions_convert_preview_kind_original')}
            </TableCell>
            <TableCell>{preview.original.description}</TableCell>
            <TableCell>
              {accountLabel(
                preview.original.credit.code,
                preview.original.credit.name,
              )}
            </TableCell>
            <TableCell>
              {accountLabel(
                preview.original.debit.code,
                preview.original.debit.name,
              )}
            </TableCell>
            <TableCell align="right">
              {formatAmount(preview.original.amount)}
            </TableCell>
            <TableCell>
              {currencyLabel(
                preview.original.currency.code,
                preview.original.currency.name,
              )}
            </TableCell>
          </TableRow>
          {preview.movements.map((movement) => (
            <TableRow key={`${movement.kind}-${movement.index ?? 's'}`}>
              <TableCell>
                {movement.kind === 'step' && movement.index != null
                  ? movement.index + 1
                  : '—'}
              </TableCell>
              <TableCell>
                {movement.kind === 'storno'
                  ? translate('app.transactions_convert_preview_kind_storno')
                  : translate('app.transactions_convert_preview_kind_step')}
              </TableCell>
              <TableCell>{movement.description}</TableCell>
              <TableCell>
                {accountLabel(movement.credit.code, movement.credit.name)}
              </TableCell>
              <TableCell>
                {accountLabel(movement.debit.code, movement.debit.name)}
              </TableCell>
              <TableCell align="right">
                {formatAmount(movement.amount)}
              </TableCell>
              <TableCell>
                {currencyLabel(movement.currency.code, movement.currency.name)}
                <RateCaption movement={movement} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Typography sx={{ mt: 1 }} variant="body2">
        {translate('app.transactions_convert_preview_steps_total', {
          steps: formatAmount(stepTotal),
          original: formatAmount(preview.original.amount),
        })}
      </Typography>
    </>
  );
}
