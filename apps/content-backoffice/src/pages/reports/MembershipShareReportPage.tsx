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
import type { BarItemIdentifier } from '@mui/x-charts/models';
import type { PieItemIdentifier } from '@mui/x-charts/models';
import { useCallback, useState, type ReactNode } from 'react';
import { Title, useTranslate } from 'react-admin';
import { useNavigate } from 'react-router-dom';

import {
  historyAmountForFocus,
  memberFocusTotal,
  mergeCurrencyAmounts,
} from './membershipShare/membershipShare.helpers';
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
import { ReportRangeFilterToolbar } from './components/ReportRangeFilterToolbar';
import {
  REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  type ReportTransactionStatusFilter as ReportTxStatusMode,
} from './shared/reportTransactionStatus';
import {
  drilldownForHistoryBar,
  drilldownForMemberBar,
  drilldownForMemberCell,
  drilldownForMemberRow,
  drilldownForPieSlice,
  type MembershipShareDrilldownContext,
  type MembershipShareLedgerLeg,
} from './membershipShare/drilldown';
import { useMembershipShareReport } from './membershipShare/useMembershipShareReport';
import {
  ReportPageHeader,
  ReportPageShell,
  ReportScrollX,
  reportBarAreaMinWidth,
  useReportChartMetrics,
} from './shared/reportLayout';

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
  const [transactionStatus, setTransactionStatus] =
    useState<ReportTxStatusMode>(REPORT_TRANSACTION_STATUS_FILTER_DEFAULT);
  const { status, report, reload } = useMembershipShareReport(
    range,
    focus,
    transactionStatus,
  );

  return (
    <ReportPageShell>
      <Title title="app.membership_share.title" />
      <ReportPageHeader
        subtitle={translate('app.membership_share.subtitle')}
        title={translate('app.membership_share.title')}
      />

      <ReportRangeFilterToolbar
        onRangeChange={setRange}
        onTransactionStatusChange={setTransactionStatus}
        range={range}
        transactionStatus={transactionStatus}
      >
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
      </ReportRangeFilterToolbar>

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
        <ReportBody
          drilldownContext={{ range, transactionStatus, focus }}
          focus={focus}
          report={report}
        />
      ) : null}
    </ReportPageShell>
  );
}

function ReportBody({
  report,
  focus,
  drilldownContext,
}: {
  report: MembershipShareReport;
  focus: LedgerFocus;
  drilldownContext: MembershipShareDrilldownContext;
}) {
  const translate = useTranslate();
  const theme = useTheme();
  const navigate = useNavigate();
  const chartMetrics = useReportChartMetrics();
  const { kpis, byMember, history, historyCurrency } = report;

  const openDrilldown = useCallback(
    (link: { pathname: '/transactions'; search: string }) => {
      navigate({ pathname: link.pathname, search: link.search });
    },
    [navigate],
  );

  const drillTip = translate('app.membership_share.drilldown.hint');

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

  const onMemberBarClick = useCallback(
    (_event: unknown, item: BarItemIdentifier) => {
      const seriesId = String(item.seriesId);
      if (seriesId !== 'share' && seriesId !== 'pocket') return;
      const member = byMember[item.dataIndex];
      if (!member) return;
      openDrilldown(
        drilldownForMemberBar(
          drilldownContext,
          member,
          seriesId as MembershipShareLedgerLeg,
          primaryCurrency,
        ),
      );
    },
    [byMember, drilldownContext, openDrilldown, primaryCurrency],
  );

  const onHistoryBarClick = useCallback(
    (_event: unknown, item: BarItemIdentifier) => {
      const member = byMember.find(
        (row) => row.memberId === String(item.seriesId),
      );
      const period = history[item.dataIndex]?.period;
      if (!member || !period) return;
      openDrilldown(
        drilldownForHistoryBar(
          drilldownContext,
          member,
          period,
          historyCurrency,
        ),
      );
    },
    [byMember, drilldownContext, history, historyCurrency, openDrilldown],
  );

  const onPieClick = useCallback(
    (_event: unknown, item: PieItemIdentifier) => {
      const slice = pieData[item.dataIndex];
      if (!slice) return;
      const currency = focus === 'both' ? primaryCurrency : String(slice.id);
      openDrilldown(
        drilldownForPieSlice(drilldownContext, String(slice.id), currency),
      );
    },
    [drilldownContext, focus, openDrilldown, pieData, primaryCurrency],
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
            <ReportScrollX
              minWidth={reportBarAreaMinWidth(
                byMember.length,
                chartMetrics.narrow,
              )}
            >
              <BarChart
                height={Math.max(
                  chartMetrics.narrow ? 200 : 220,
                  byMember.length * (chartMetrics.narrow ? 30 : 36),
                )}
                layout="horizontal"
                margin={{
                  left: chartMetrics.bandYAxisWidth,
                  right: chartMetrics.narrow ? 8 : 16,
                  top: 16,
                  bottom: 24,
                }}
                onItemClick={onMemberBarClick}
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
                          label: translate(
                            'app.membership_share.ledger.pocket',
                          ),
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
                    width: chartMetrics.bandYAxisWidth,
                  },
                ]}
              />
            </ReportScrollX>
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
              height={chartMetrics.narrow ? 220 : 260}
              margin={{ top: 16, bottom: 16, left: 16, right: 16 }}
              onItemClick={onPieClick}
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
          <ReportScrollX minWidth={chartMetrics.narrow ? 520 : undefined}>
            <Table
              size="small"
              sx={{ minWidth: chartMetrics.narrow ? 520 : 0 }}
            >
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
                    <DrilldownCell
                      align="left"
                      onOpen={() =>
                        openDrilldown(
                          drilldownForMemberRow(drilldownContext, row),
                        )
                      }
                      title={drillTip}
                    >
                      {row.memberName}
                    </DrilldownCell>
                    {showShare
                      ? currencies.map((currency) => (
                          <AmountDrilldownCell
                            align="right"
                            amounts={row.shareByCurrency}
                            currency={currency}
                            key={`s-${currency}`}
                            onOpen={() =>
                              openDrilldown(
                                drilldownForMemberCell(
                                  drilldownContext,
                                  row,
                                  currency,
                                  'share',
                                ),
                              )
                            }
                            title={drillTip}
                          />
                        ))
                      : null}
                    {showPocket
                      ? currencies.map((currency) => (
                          <AmountDrilldownCell
                            align="right"
                            amounts={row.pocketByCurrency}
                            currency={currency}
                            key={`p-${currency}`}
                            onOpen={() =>
                              openDrilldown(
                                drilldownForMemberCell(
                                  drilldownContext,
                                  row,
                                  currency,
                                  'pocket',
                                ),
                              )
                            }
                            title={drillTip}
                          />
                        ))
                      : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportScrollX>
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
          <ReportScrollX
            minWidth={reportBarAreaMinWidth(
              history.length,
              chartMetrics.narrow,
            )}
          >
            <BarChart
              height={chartMetrics.narrow ? 280 : 320}
              margin={{
                left: chartMetrics.historyYAxisWidth,
                right: chartMetrics.narrow ? 8 : 16,
                top: 24,
                bottom: chartMetrics.narrow ? 56 : 40,
              }}
              onItemClick={onHistoryBarClick}
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
              yAxis={[{ min: 0, width: chartMetrics.historyYAxisWidth }]}
            />
          </ReportScrollX>
        )}
      </Section>
    </Stack>
  );
}

function AmountDrilldownCell({
  align,
  amounts,
  currency,
  onOpen,
  title,
}: {
  align: 'left' | 'right';
  amounts: CurrencyAmount[];
  currency: string;
  onOpen: () => void;
  title: string;
}) {
  const amount = amounts.find((row) => row.currency === currency)?.amount ?? 0;
  if (amount === 0) {
    return (
      <TableCell align={align}>
        <Typography color="text.secondary" variant="body2">
          —
        </Typography>
      </TableCell>
    );
  }
  return (
    <DrilldownCell align={align} onOpen={onOpen} title={title}>
      {formatMoney(amount, currency)}
    </DrilldownCell>
  );
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
