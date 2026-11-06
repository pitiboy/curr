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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
  type Theme,
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { useState, type ReactNode } from 'react';
import { Title, useTranslate } from 'react-admin';

import {
  historyAmountForFocus,
  memberFocusTotal,
  mergeCurrencyAmounts,
} from './membershipShare/membershipShare.mock';
import type {
  CurrencyAmount,
  DateRangePreset,
  LedgerFocus,
  MembershipShareReport,
} from './membershipShare/types';
import {
  MEMBER_POCKET_ACCOUNT_CODE,
  MEMBER_SHARE_ACCOUNT_CODE,
} from './membershipShare/types';
import { useMembershipShareReport } from './membershipShare/useMembershipShareReport';

const RANGE_PRESETS: DateRangePreset[] = [
  'all',
  'thisMonth',
  'lastMonth',
  'last7',
  'thisYear',
];

const LEDGER_FOCUSES: LedgerFocus[] = ['both', 'share', 'pocket'];

function memberSeriesColors(theme: Theme): string[] {
  return [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.success.main,
  ];
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'HUF' ? 0 : 2,
  }).format(amount);
}

function formatPlain(amount: number): string {
  return new Intl.NumberFormat('hu-HU').format(amount);
}

export function MembershipShareReportPage() {
  const translate = useTranslate();
  const [range, setRange] = useState<DateRangePreset>('thisMonth');
  const [focus, setFocus] = useState<LedgerFocus>('both');
  const { status, report, reload } = useMembershipShareReport(range, focus);

  return (
    <Box sx={{ p: 2, maxWidth: 1100 }}>
      <Title title="app.membership_share.title" />
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography component="h1" variant="h5">
          {translate('app.membership_share.title')}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {translate('app.membership_share.subtitle')}
        </Typography>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ mb: 2, flexWrap: 'wrap' }}
      >
        <ToggleButtonGroup
          color="primary"
          exclusive
          onChange={(_e, value: DateRangePreset | null) => {
            if (value) setRange(value);
          }}
          size="small"
          sx={{ flexWrap: 'wrap' }}
          value={range}
        >
          {RANGE_PRESETS.map((preset) => (
            <ToggleButton key={preset} value={preset}>
              {translate(`app.membership_share.range.${preset}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <ToggleButtonGroup
          color="primary"
          exclusive
          onChange={(_e, value: LedgerFocus | null) => {
            if (value) setFocus(value);
          }}
          size="small"
          sx={{ flexWrap: 'wrap' }}
          value={focus}
        >
          {LEDGER_FOCUSES.map((key) => (
            <ToggleButton key={key} value={key}>
              {translate(`app.membership_share.focus.${key}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {status === 'loading' ? <ReportSkeleton /> : null}
      {status === 'error' ? (
        <Alert
          action={
            <Button color="inherit" onClick={reload} size="small">
              {translate('app.membership_share.retry')}
            </Button>
          }
          severity="error"
          variant="outlined"
        >
          {translate('app.membership_share.error')}
        </Alert>
      ) : null}
      {status === 'empty' ? (
        <Alert severity="info" variant="outlined">
          {translate('app.membership_share.empty')}
        </Alert>
      ) : null}
      {status === 'success' && report ? (
        <ReportBody focus={focus} report={report} />
      ) : null}
    </Box>
  );
}

function ReportBody({
  report,
  focus,
}: {
  report: MembershipShareReport;
  focus: LedgerFocus;
}) {
  const translate = useTranslate();
  const theme = useTheme();
  const { kpis, byMember, history, historyCurrency } = report;

  const showShare = focus === 'both' || focus === 'share';
  const showPocket = focus === 'both' || focus === 'pocket';
  const seriesColors = memberSeriesColors(theme);

  const currencies = [
    ...new Set(
      mergeCurrencyAmounts(kpis.shareByCurrency, kpis.pocketByCurrency).map(
        (row) => row.currency,
      ),
    ),
  ].sort();
  const primaryCurrency = currencies[0] ?? 'HUF';

  const memberLabels = byMember.map((row) => row.memberName);
  const shareBarData = byMember.map((row) =>
    memberFocusTotal(row, 'share', primaryCurrency),
  );
  const pocketBarData = byMember.map((row) =>
    memberFocusTotal(row, 'pocket', primaryCurrency),
  );

  /** Share vs pocket pie uses one currency only — never sum across FX. */
  const pieData =
    focus === 'both'
      ? [
          {
            id: 'share',
            label: translate('app.membership_share.ledger.share'),
            value:
              kpis.shareByCurrency.find((r) => r.currency === primaryCurrency)
                ?.amount ?? 0,
            color: theme.palette.primary.main,
          },
          {
            id: 'pocket',
            label: translate('app.membership_share.ledger.pocket'),
            value:
              kpis.pocketByCurrency.find((r) => r.currency === primaryCurrency)
                ?.amount ?? 0,
            color: theme.palette.warning.main,
          },
        ].filter((row) => row.value > 0)
      : (focus === 'share' ? kpis.shareByCurrency : kpis.pocketByCurrency).map(
          (row, index) => ({
            id: row.currency,
            label: row.currency,
            value: row.amount,
            color:
              index === 0
                ? theme.palette.primary.main
                : index === 1
                  ? theme.palette.secondary.main
                  : theme.palette.info.main,
          }),
        );

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
        }}
      >
        {showShare
          ? kpis.shareByCurrency.map((row) => (
              <KpiTile
                key={`share-${row.currency}`}
                label={translate('app.membership_share.kpi.share', {
                  currency: row.currency,
                  code: MEMBER_SHARE_ACCOUNT_CODE,
                })}
                valueLabel={formatMoney(row.amount, row.currency)}
              />
            ))
          : null}
        {showPocket
          ? kpis.pocketByCurrency.map((row) => (
              <KpiTile
                key={`pocket-${row.currency}`}
                label={translate('app.membership_share.kpi.pocket', {
                  currency: row.currency,
                  code: MEMBER_POCKET_ACCOUNT_CODE,
                })}
                valueLabel={formatMoney(row.amount, row.currency)}
              />
            ))
          : null}
        <KpiTile
          label={translate('app.membership_share.kpi.members')}
          valueLabel={formatPlain(kpis.memberCount)}
        />
        <KpiTile
          label={translate('app.membership_share.kpi.payments')}
          valueLabel={formatPlain(kpis.paymentCount)}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' },
        }}
      >
        <Section
          title={translate('app.membership_share.bar_title', {
            currency: primaryCurrency,
          })}
        >
          {byMember.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              {translate('app.membership_share.empty')}
            </Typography>
          ) : (
            <BarChart
              height={Math.max(220, byMember.length * 36)}
              layout="horizontal"
              margin={{ left: 72, right: 16, top: 16, bottom: 24 }}
              series={[
                ...(showShare
                  ? [
                      {
                        data: shareBarData,
                        label: translate('app.membership_share.ledger.share'),
                        color: theme.palette.primary.main,
                        id: 'share',
                        stack: 'total',
                      },
                    ]
                  : []),
                ...(showPocket
                  ? [
                      {
                        data: pocketBarData,
                        label: translate('app.membership_share.ledger.pocket'),
                        color: theme.palette.warning.main,
                        id: 'pocket',
                        stack: 'total',
                      },
                    ]
                  : []),
              ]}
              slotProps={{ legend: { direction: 'horizontal' } }}
              xAxis={[{ min: 0 }]}
              yAxis={[
                {
                  data: memberLabels,
                  scaleType: 'band',
                  width: 72,
                },
              ]}
            />
          )}
        </Section>

        <Section
          title={
            focus === 'both'
              ? translate('app.membership_share.pie_title_ledgers', {
                  currency: primaryCurrency,
                })
              : translate('app.membership_share.pie_title_currencies')
          }
        >
          {pieData.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              {translate('app.membership_share.empty')}
            </Typography>
          ) : (
            <PieChart
              height={260}
              margin={{ top: 16, bottom: 16, left: 16, right: 16 }}
              series={[
                {
                  data: pieData,
                  innerRadius: 48,
                  outerRadius: 90,
                  paddingAngle: 2,
                  cornerRadius: 2,
                  highlightScope: { fade: 'global', highlight: 'item' },
                },
              ]}
              slotProps={{ legend: { direction: 'horizontal' } }}
            />
          )}
        </Section>
      </Box>

      <Section title={translate('app.membership_share.members_title')}>
        <Typography color="text.secondary" sx={{ mb: 1.5 }} variant="body2">
          {translate('app.membership_share.members_subtitle')}
        </Typography>
        {byMember.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            {translate('app.membership_share.empty')}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  {translate('app.membership_share.member_name')}
                </TableCell>
                {showShare
                  ? currencies.map((currency) => (
                      <TableCell align="right" key={`h-share-${currency}`}>
                        {translate('app.membership_share.col.share', {
                          currency,
                          code: MEMBER_SHARE_ACCOUNT_CODE,
                        })}
                      </TableCell>
                    ))
                  : null}
                {showPocket
                  ? currencies.map((currency) => (
                      <TableCell align="right" key={`h-pocket-${currency}`}>
                        {translate('app.membership_share.col.pocket', {
                          currency,
                          code: MEMBER_POCKET_ACCOUNT_CODE,
                        })}
                      </TableCell>
                    ))
                  : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {byMember.map((row) => (
                <TableRow key={row.memberId}>
                  <TableCell>{row.memberName}</TableCell>
                  {showShare
                    ? currencies.map((currency) => (
                        <TableCell align="right" key={`s-${currency}`}>
                          <AmountCell
                            amounts={row.shareByCurrency}
                            currency={currency}
                          />
                        </TableCell>
                      ))
                    : null}
                  {showPocket
                    ? currencies.map((currency) => (
                        <TableCell align="right" key={`p-${currency}`}>
                          <AmountCell
                            amounts={row.pocketByCurrency}
                            currency={currency}
                          />
                        </TableCell>
                      ))
                    : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section
        title={translate('app.membership_share.history_title', {
          currency: historyCurrency,
        })}
      >
        <Typography color="text.secondary" sx={{ mb: 1.5 }} variant="body2">
          {translate('app.membership_share.history_subtitle')}
        </Typography>
        {history.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            {translate('app.membership_share.empty')}
          </Typography>
        ) : (
          <BarChart
            height={320}
            margin={{ left: 64, right: 16, top: 24, bottom: 40 }}
            series={byMember.map((member, index) => ({
              id: member.memberId,
              label: member.memberName,
              data: history.map((point) =>
                historyAmountForFocus(
                  point.byMember[member.memberId] ?? {
                    share: 0,
                    pocket: 0,
                  },
                  focus,
                ),
              ),
              stack: 'payments',
              color: seriesColors[index % seriesColors.length],
            }))}
            slotProps={{ legend: { direction: 'horizontal' } }}
            xAxis={[
              {
                data: history.map((point) => point.period),
                scaleType: 'band',
                tickLabelStyle: { fontSize: 11 },
              },
            ]}
            yAxis={[{ min: 0, width: 56 }]}
          />
        )}
      </Section>
    </Stack>
  );
}

function AmountCell({
  amounts,
  currency,
}: {
  amounts: CurrencyAmount[];
  currency: string;
}) {
  const amount = amounts.find((row) => row.currency === currency)?.amount ?? 0;
  if (amount === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        —
      </Typography>
    );
  }
  return (
    <Typography
      component="span"
      sx={{ fontVariantNumeric: 'tabular-nums' }}
      variant="body2"
    >
      {formatMoney(amount, currency)}
    </Typography>
  );
}

function KpiTile({ label, valueLabel }: { label: string; valueLabel: string }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        px: 1.5,
        py: 1.25,
      }}
    >
      <Typography color="text.secondary" variant="caption">
        {label}
      </Typography>
      <Typography
        color="text.primary"
        sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
        variant="h6"
      >
        {valueLabel}
      </Typography>
    </Paper>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography component="h2" sx={{ mb: 1 }} variant="subtitle1">
        {title}
      </Typography>
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 1.5 }}>
        {children}
      </Paper>
    </Box>
  );
}

function ReportSkeleton() {
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
        }}
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={72} variant="rounded" />
        ))}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' },
        }}
      >
        <Skeleton height={280} variant="rounded" />
        <Skeleton height={280} variant="rounded" />
      </Box>
      <Skeleton height={220} variant="rounded" />
      <Skeleton height={320} variant="rounded" />
    </Stack>
  );
}
