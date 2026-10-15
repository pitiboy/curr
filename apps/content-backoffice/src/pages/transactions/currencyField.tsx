import { Box } from '@mui/material';

import { STRAPI_URL } from '../../config';

const rowSx = {
  alignItems: 'center',
  display: 'inline-flex',
  gap: 0.75,
  verticalAlign: 'middle',
} as const;

export function CurrencyValue({ value }: { value: unknown }) {
  const src = currencyIconSrc(value);
  return (
    <Box component="span" sx={rowSx}>
      {src ? (
        <Box
          alt=""
          component="img"
          src={src}
          sx={{ flexShrink: 0, height: 22, objectFit: 'contain', width: 22 }}
        />
      ) : null}
      {currencyLabel(value)}
    </Box>
  );
}

function currencyLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const currency = value as { code?: string | null; name?: string | null };
  return [currency.code, currency.name].filter(Boolean).join(' ') || '—';
}

function currencyIconSrc(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const url = mediaUrl((value as { icon?: unknown }).icon);
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const origin = STRAPI_URL.replace(/\/$/, '');
  return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`;
}

function mediaUrl(icon: unknown): string | null {
  const file = Array.isArray(icon) ? icon[0] : icon;
  if (!file || typeof file !== 'object') return null;
  const url = (file as { url?: unknown }).url;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}
