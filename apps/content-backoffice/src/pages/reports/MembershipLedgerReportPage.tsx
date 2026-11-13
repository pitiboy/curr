import {
  Alert,
  Box,
  Button,
  Paper,
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
import { Title, useTranslate } from 'react-admin';

import {
  useGlobalReportParams,
  useGlobalTransactionFilters,
} from '../../filters/globalTransactionFiltersAtom';
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
  const [filters] = useGlobalTransactionFilters();
  const currency = filters.currency_type?.trim() || 'HUF';
  const chartMetrics = useReportChartMetrics();

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

      <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
        {translate('app.membership_ledger.active_currency', { currency })}
      </Typography>

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
          {!report.hasActivity ? (
            <Alert severity="info" variant="outlined">
              {translate('app.membership_ledger.empty_activity', { currency })}
            </Alert>
          ) : null}
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
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
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
