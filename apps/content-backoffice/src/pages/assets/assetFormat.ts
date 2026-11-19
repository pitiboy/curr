import type { AssetRecord } from '../../data/assetData';

export const amountFormat = new Intl.NumberFormat('hu-HU', {
  maximumFractionDigits: 2,
});

export function formatAssetPrice(
  record: Pick<AssetRecord, 'purchase_price' | 'refs'> | undefined,
): string {
  if (record?.purchase_price == null) return '—';
  const currency = record.refs?.currency_type?.code ?? '';
  return `${amountFormat.format(record.purchase_price)} ${currency}`.trim();
}
