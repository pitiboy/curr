import { Link } from '@mui/material';
import { useTranslate } from 'react-admin';
import { Link as RouterLink } from 'react-router-dom';

import type { AssetTransactionRef } from '../../data/assetData';
import { amountFormat } from './assetFormat';

export function EnumLabel({
  kind,
  value,
}: {
  kind: 'ownership_types' | 'statuses';
  value: string | null | undefined;
}) {
  const translate = useTranslate();
  if (!value) return <>—</>;
  return <>{translate(`app.assets.${kind}.${value}`, { _: value })}</>;
}

export function TransactionRefLink({
  value,
}: {
  value: AssetTransactionRef | null | undefined;
}) {
  if (!value) return <>—</>;
  const amount =
    value.amount == null
      ? ''
      : `${amountFormat.format(Number(value.amount))} ${value.currencyCode ?? ''}`.trim();
  const label = [value.date, amount, value.description]
    .filter((part) => part != null && String(part).trim() !== '')
    .join(' · ');
  return (
    <Link
      component={RouterLink}
      onClick={(event) => event.stopPropagation()}
      to={`/transactions/${encodeURIComponent(value.documentId)}/show`}
    >
      {label || value.documentId}
    </Link>
  );
}
