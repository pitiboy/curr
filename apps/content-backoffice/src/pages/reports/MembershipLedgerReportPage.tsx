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
import type { ReactNode } from 'react';
import { Title, useTranslate } from 'react-admin';

import {
  useGlobalReportParams,
  useGlobalTransactionFilters,
  useOpenDrilldown,
} from '../../filters/globalTransactionFiltersAtom';
import {
  drilldownForMemberCell,
  drilldownForMemberRow,
  type MembershipLedgerColumn,
  type MembershipLedgerDrilldownContext,
  type MembershipLedgerLeg,
} from './membershipLedger/drilldown';
import type { MembershipLedgerMemberRow } from './membershipLedger/types';
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

function DrilldownCell({
  align,
  children,
  onOpen,
  title,
}: {
  align: 'left' | 'right';
  children: ReactNode;
  onOpen: () => void;
  title: string;
}) {
  return (
    <TableCell
      align={align}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      sx={{
        cursor: 'pointer',
        '&:hover': { textDecoration: 'underline' },
      }}
      tabIndex={0}
      title={title}
    >
      {children}
    </TableCell>
  );
}

function AmountDrilldownCell({
  amount,
  currency,
  onOpen,
  title,
}: {
  amount: number;
  currency: string;
  onOpen: () => void;
  title: string;
}) {
  return (
    <DrilldownCell align="right" onOpen={onOpen} title={title}>
      <Typography
        color={amount === 0 ? 'text.secondary' : 'text.primary'}
        sx={{ fontVariantNumeric: 'tabular-nums' }}
        variant="body2"
      >
        {amount === 0 ? '0' : formatMoney(amount, currency)}
      </Typography>
    </DrilldownCell>
  );
}

export function MembershipLedgerReportPage() {
  const translate = useTranslate();
  const params = useGlobalReportParams();
  const [filters] = useGlobalTransactionFilters();
  const currency = filters.currency_type?.trim() || 'HUF';
  const chartMetrics = useReportChartMetrics();
  const openDrilldown = useOpenDrilldown();

  const { status, report, reload } = useMembershipLedgerReport(
    params,
    currency,
  );

  const drilldownContext: MembershipLedgerDrilldownContext = {
    range: params.preset,
    bounds: params.bounds,
    transactionStatus: params.transactionStatus,
    currencyCode: currency,
  };

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
              drilldownContext={drilldownContext}
              key={section.membershipId}
              onOpenDrilldown={openDrilldown}
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
  drilldownContext,
  onOpenDrilldown,
  translate,
}: {
  section: {
    membershipId: string;
    membershipName: string;
    membershipTypeName: string | null;
    members: MembershipLedgerMemberRow[];
  };
  currency: string;
  chartMetricsNarrow: boolean;
  drilldownContext: MembershipLedgerDrilldownContext;
  onOpenDrilldown: ReturnType<typeof useOpenDrilldown>;
  translate: (key: string, options?: Record<string, unknown>) => string;
}) {
  const shareCode = MEMBER_SHARE_ACCOUNT_CODE;
  const pocketCode = MEMBER_POCKET_ACCOUNT_CODE;
  const drillTip = translate('app.membership_ledger.drilldown.hint');

  const openCell = (
    row: MembershipLedgerMemberRow,
    leg: MembershipLedgerLeg,
    column: MembershipLedgerColumn,
  ) => {
    onOpenDrilldown(drilldownForMemberCell(drilldownContext, row, leg, column));
  };

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
                  <DrilldownCell
                    align="left"
                    onOpen={() =>
                      onOpenDrilldown(
                        drilldownForMemberRow(drilldownContext, row),
                      )
                    }
                    title={drillTip}
                  >
                    {row.memberName}
                  </DrilldownCell>
                  <AmountDrilldownCell
                    amount={row.sharePayment}
                    currency={currency}
                    onOpen={() => openCell(row, 'share', 'payment')}
                    title={drillTip}
                  />
                  <AmountDrilldownCell
                    amount={row.shareDeduction}
                    currency={currency}
                    onOpen={() => openCell(row, 'share', 'deduction')}
                    title={drillTip}
                  />
                  <AmountDrilldownCell
                    amount={row.shareBalance}
                    currency={currency}
                    onOpen={() => openCell(row, 'share', 'balance')}
                    title={drillTip}
                  />
                  <AmountDrilldownCell
                    amount={row.pocketPayment}
                    currency={currency}
                    onOpen={() => openCell(row, 'pocket', 'payment')}
                    title={drillTip}
                  />
                  <AmountDrilldownCell
                    amount={row.pocketDeduction}
                    currency={currency}
                    onOpen={() => openCell(row, 'pocket', 'deduction')}
                    title={drillTip}
                  />
                  <AmountDrilldownCell
                    amount={row.pocketBalance}
                    currency={currency}
                    onOpen={() => openCell(row, 'pocket', 'balance')}
                    title={drillTip}
                  />
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
