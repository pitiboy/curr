import InputIcon from '@mui/icons-material/Input';
import OutputIcon from '@mui/icons-material/Output';
import { Box } from '@mui/material';
import { useTranslate } from 'react-admin';

export type AccountKind = 'debit' | 'credit';

const rowSx = {
  alignItems: 'center',
  display: 'inline-flex',
  gap: 0.5,
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
} as const;

export function AccountKindIcon({ kind }: { kind: AccountKind }) {
  const Icon = kind === 'credit' ? OutputIcon : InputIcon;
  return <Icon sx={{ flexShrink: 0, fontSize: '1.1em' }} />;
}

export function accountLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '—';
  const account = value as { code?: string | null; name?: string | null };
  return [account.code, account.name].filter(Boolean).join(' ') || '—';
}

export function AccountFieldLabel({
  kind,
  required = false,
}: {
  kind: AccountKind;
  required?: boolean;
}) {
  const translate = useTranslate();
  const source = kind === 'credit' ? 'credit_account' : 'debit_account';
  return (
    <Box component="span" sx={rowSx}>
      <AccountKindIcon kind={kind} />
      <span>
        {translate(`resources.transactions.fields.${source}`)}
        {required ? <span aria-hidden="true">&thinsp;*</span> : null}
      </span>
    </Box>
  );
}

export function AccountValue({
  kind,
  value,
}: {
  kind: AccountKind;
  value: unknown;
}) {
  return (
    <Box component="span" sx={rowSx}>
      <AccountKindIcon kind={kind} />
      {accountLabel(value)}
    </Box>
  );
}
