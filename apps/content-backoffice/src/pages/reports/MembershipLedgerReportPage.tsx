import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { useMemo, useState } from 'react';
import { Title, useTranslate } from 'react-admin';

import { useGlobalReportParams } from '../../filters/globalTransactionFiltersAtom';
import {
  MEMBER_POCKET_ACCOUNT_CODE,
  MEMBER_SHARE_ACCOUNT_CODE,
} from './membershipLedger/types';
import { useMembershipLedgerReport } from './membershipLedger/useMembershipLedgerReport';
import {
  ReportPageHeader,
  ReportPageShell,
  ReportScrollX,
  useReportChartMetrics,
} from './shared/reportLayout';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'HUF' ? 0 : 2,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat('hu-HU').format(amount);
  }
}

function AmountCell({
  amount,
  currency,
}: {
  amount: number;
  currency: string;
}) {
  return (
    <TableCell align="right">
      <Typography
        color={amount === 0 ? 'text.secondary' : 'text.primary'}
        sx={{ fontVariantNumeric: 'tabular-nums' }}
        variant="body2"
      >
        {amount === 0 ? '0' : formatMoney(amount, currency)}
      </Typography>
    </TableCell>
  );
}

export function MembershipLedgerReportPage() {
  const translate = useTranslate();
  const params = useGlobalReportParams();
  const [currencyChoice, setCurrencyChoice] = useState<string | null>(null);
  const chartMetrics = useReportChartMetrics();

  const currencyOptions = useMemo(() => {
    if (report?.currencies.length) return report.currencies;
    const fromTxs = loaded?.txs
      ? [...new Set(loaded.txs.map((tx) => tx.currencyCode))].sort()
      : [];
    if (fromTxs.length > 0) return fromTxs;
    return ['HUF'];
  }, [loaded, report]);

  const currency = useMemo(() => {
    if (currencyChoice && currencyOptions.includes(currencyChoice)) {
      return currencyChoice;
    }
    if (currencyOptions.includes('HUF')) return 'HUF';
    return currencyOptions[0] ?? 'HUF';
  }, [currencyChoice, currencyOptions]);

  const { status, report, reload } = useMembershipLedgerReport(
    params,
    currency,
  );

  return (
    <ReportPageShell>
      <Title title="app.membership_ledger.title" />
      <ReportPageHeader
        subtitle={translate('app.membership_ledger.subtitle')}
        title={translate('app.membership_ledger.title')}
      />

      <FormControl size="small" sx={{ minWidth: 140, mb: 2 }}>
        <InputLabel id="membership-ledger-currency-label">
          {translate('app.membership_ledger.currency')}
        </InputLabel>
        <Select
          id="membership-ledger-currency"
          label={translate('app.membership_ledger.currency')}
          labelId="membership-ledger-currency-label"
          onChange={(event) => setCurrencyChoice(String(event.target.value))}
          value={currency}
        >
          {currencyOptions.map((code) => (
            <MenuItem key={code} value={code}>
              {code}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {status === 'loading' ? <ReportSkeleton /> : null}
      {status === 'error' ? (
        <Alert
          action={
            <Button color="inherit" onClick={reload} size="small">
              {translate('app.membership_ledger.retry')}
            </Button>
          }
          severity="error"
          variant="outlined"
        >
          {translate('app.membership_ledger.error')}
        </Alert>
      ) : null}
      {status === 'empty' ? (
        <Alert severity="info" variant="outlined">
          {translate('app.membership_ledger.empty')}
        </Alert>
      ) : null}
      {status === 'success' && report ? (
        <Stack spacing={3}>
          {report.sections.map((section) => (
            <MembershipSection
              chartMetricsNarrow={chartMetrics.narrow}
              currency={currency}
              key={section.membershipId}
              section={section}
              translate={translate}
            />
          ))}
        </Stack>
      ) : null}
    </ReportPageShell>
  );
}

function MembershipSection({
  section,
  currency,
  chartMetricsNarrow,
  translate,
}: {
  section: {
    membershipId: string;
    membershipName: string;
    membershipTypeName: string | null;
    members: {
      memberId: string;
      memberName: string;
      sharePayment: number;
      shareDeduction: number;
      shareBalance: number;
      pocketPayment: number;
      pocketDeduction: number;
      pocketBalance: number;
    }[];
  };
  currency: string;
  chartMetricsNarrow: boolean;
  translate: (key: string, options?: Record<string, unknown>) => string;
}) {
  const shareCode = MEMBER_SHARE_ACCOUNT_CODE;
  const pocketCode = MEMBER_POCKET_ACCOUNT_CODE;

  return (
    <Box>
      <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
        <GroupsOutlinedIcon color="action" fontSize="small" />
        <Typography component="h2" variant="subtitle1">
          {section.membershipName}
          {section.membershipTypeName ? (
            <Typography
              color="text.secondary"
              component="span"
              sx={{ ml: 1 }}
              variant="body2"
            >
              ({section.membershipTypeName})
            </Typography>
          ) : null}
        </Typography>
      </Stack>
      <Paper
        elevation={0}
        sx={{
          border: 1,
          borderColor: 'divider',
          maxWidth: '100%',
          minWidth: 0,
          p: { xs: 1, sm: 1.5 },
        }}
      >
        <ReportScrollX minWidth={chartMetricsNarrow ? 720 : undefined}>
          <Table size="small" sx={{ minWidth: chartMetricsNarrow ? 720 : 0 }}>
            <TableHead>
              <TableRow>
                <TableCell>
                  {translate('app.membership_ledger.member')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.membership_ledger.col.payment', {
                    code: shareCode,
                  })}
                </TableCell>
                <TableCell align="right">
                  {translate('app.membership_ledger.col.deduction', {
                    code: shareCode,
                  })}
                </TableCell>
                <TableCell align="right">
                  {translate('app.membership_ledger.col.balance', {
                    code: shareCode,
                  })}
                </TableCell>
                <TableCell align="right">
                  {translate('app.membership_ledger.col.payment', {
                    code: pocketCode,
                  })}
                </TableCell>
                <TableCell align="right">
                  {translate('app.membership_ledger.col.deduction', {
                    code: pocketCode,
                  })}
                </TableCell>
                <TableCell align="right">
                  {translate('app.membership_ledger.col.balance', {
                    code: pocketCode,
                  })}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {section.members.map((row) => (
                <TableRow key={row.memberId}>
                  <TableCell>{row.memberName}</TableCell>
                  <AmountCell amount={row.sharePayment} currency={currency} />
                  <AmountCell amount={row.shareDeduction} currency={currency} />
                  <AmountCell amount={row.shareBalance} currency={currency} />
                  <AmountCell amount={row.pocketPayment} currency={currency} />
                  <AmountCell
                    amount={row.pocketDeduction}
                    currency={currency}
                  />
                  <AmountCell amount={row.pocketBalance} currency={currency} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportScrollX>
      </Paper>
    </Box>
  );
}

function ReportSkeleton() {
  return (
    <Stack spacing={2}>
      {Array.from({ length: 2 }, (_, i) => (
        <Skeleton height={180} key={i} variant="rounded" />
      ))}
    </Stack>
  );
}
