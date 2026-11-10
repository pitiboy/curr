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
  useTheme,
} from '@mui/material';
import { BarPlot } from '@mui/x-charts/BarChart';
import { ChartsContainer } from '@mui/x-charts/ChartsContainer';
import { ChartsGrid } from '@mui/x-charts/ChartsGrid';
import { ChartsLegend } from '@mui/x-charts/ChartsLegend';
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip';
import { ChartsXAxis } from '@mui/x-charts/ChartsXAxis';
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis';
import { LinePlot, MarkPlot } from '@mui/x-charts/LineChart';
import { useState, type ReactNode } from 'react';
import { Title, useTranslate } from 'react-admin';

import { ReportRangeFilterToolbar } from './components/ReportRangeFilterToolbar';
import type {
  DateRangePreset,
  HenInventoryReport,
  HenMemberOutflowRow,
  HenOutflowTimeseriesPoint,
  HenStockTimeseriesPoint,
} from './henInventory/types';
import { useHenInventoryReport } from './henInventory/useHenInventoryReport';
import {
  REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  type ReportTransactionStatusFilter,
} from './shared/reportTransactionStatus';
import {
  ReportPageHeader,
  ReportPageShell,
  ReportScrollX,
  reportBarAreaMinWidth,
  useReportChartMetrics,
} from './shared/reportLayout';

const MEMBER_BAR_COLORS = [
  '#346C3E',
  '#C47B2C',
  '#2F6F8F',
  '#8B5A2B',
  '#5C6B4A',
  '#A65D57',
] as const;

function formatQty(n: number): string {
  return new Intl.NumberFormat('hu-HU').format(n);
}

export function HenInventoryReportPage() {
  const translate = useTranslate();
  const [range, setRange] = useState<DateRangePreset>('thisMonth');
  const [transactionStatus, setTransactionStatus] =
    useState<ReportTransactionStatusFilter>(
      REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
    );
  const { status, report, reload } = useHenInventoryReport(
    range,
    transactionStatus,
  );

  return (
    <ReportPageShell>
      <Title title="app.hen_inventory.title" />
      <ReportPageHeader
        subtitle={translate('app.hen_inventory.subtitle')}
        title={translate('app.hen_inventory.title')}
      />

      <ReportRangeFilterToolbar
        onRangeChange={setRange}
        onTransactionStatusChange={setTransactionStatus}
        range={range}
        transactionStatus={transactionStatus}
      />

      {status === 'loading' ? <ReportSkeleton /> : null}
      {status === 'error' ? (
        <Alert
          action={
            <Button color="inherit" onClick={reload} size="small">
              {translate('app.hen_inventory.retry')}
            </Button>
          }
          severity="error"
          variant="outlined"
        >
          {translate('app.hen_inventory.error')}
        </Alert>
      ) : null}
      {status === 'empty' ? (
        <Alert severity="info" variant="outlined">
          {translate('app.hen_inventory.empty')}
        </Alert>
      ) : null}
      {status === 'success' && report ? <ReportBody report={report} /> : null}
    </ReportPageShell>
  );
}

function ReportBody({ report }: { report: HenInventoryReport }) {
  const translate = useTranslate();
  const theme = useTheme();
  const { kpis, stockTimeseries, byAlom, outflowTimeseries, byMember } = report;
  const periods = stockTimeseries.map((p) => p.period);
  const alomNames = Object.keys(stockTimeseries[0]?.byAlom ?? {}).sort((a, b) =>
    a.localeCompare(b, 'hu'),
  );
  const alomColors = [
    theme.palette.primary.main,
    theme.palette.info.main,
    theme.palette.success.main,
    theme.palette.warning.main,
  ];

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(5, 1fr)',
          },
        }}
      >
        <KpiTile
          label={translate('app.hen_inventory.kpi.stock')}
          value={kpis.totalStock}
        />
        <KpiTile
          label={translate('app.hen_inventory.kpi.intake')}
          value={kpis.intakeInPeriod}
        />
        <KpiTile
          label={translate('app.hen_inventory.kpi.slaughter')}
          value={kpis.slaughterInPeriod}
        />
        <KpiTile
          label={translate('app.hen_inventory.kpi.transfer')}
          value={kpis.transferInPeriod}
        />
        <KpiTile
          label={translate('app.hen_inventory.kpi.mortality')}
          value={kpis.mortalityInPeriod}
        />
      </Box>

      <Section title={translate('app.hen_inventory.stock_timeseries_title')}>
        {stockTimeseries.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            {translate('app.hen_inventory.empty')}
          </Typography>
        ) : (
          <HenStockLineChart
            alomColors={alomColors}
            alomNames={alomNames}
            periods={periods}
            timeseries={stockTimeseries}
          />
        )}
      </Section>

      <Section title={translate('app.hen_inventory.alom_title')}>
        <ReportScrollX>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  {translate('app.hen_inventory.alom_name')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.hen_inventory.kpi.stock')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.hen_inventory.kpi.intake')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.hen_inventory.kpi.mortality')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {byAlom.map((row) => (
                <TableRow key={row.alomName}>
                  <TableCell>{row.alomName}</TableCell>
                  <TableCell align="right">{formatQty(row.stockEnd)}</TableCell>
                  <TableCell align="right">{formatQty(row.intake)}</TableCell>
                  <TableCell align="right">
                    {formatQty(row.mortality)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportScrollX>
      </Section>

      <Section title={translate('app.hen_inventory.slaughter_chart_title')}>
        <OutflowMemberBarChart
          emptyLabel={translate('app.hen_inventory.slaughter_empty')}
          members={byMember}
          mode="transfer"
          timeseries={outflowTimeseries}
        />
      </Section>

      <Section title={translate('app.hen_inventory.members_title')}>
        {byMember.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            {translate('app.hen_inventory.outflow_empty')}
          </Typography>
        ) : (
          <ReportScrollX minWidth={480}>
            <Table size="small" sx={{ minWidth: 480 }}>
              <TableHead>
                <TableRow>
                  <TableCell>
                    {translate('app.hen_inventory.member_name')}
                  </TableCell>
                  <TableCell>
                    {translate('app.hen_inventory.member_account')}
                  </TableCell>
                  <TableCell align="right">
                    {translate('app.hen_inventory.kpi.slaughter')}
                  </TableCell>
                  <TableCell align="right">
                    {translate('app.hen_inventory.kpi.transfer')}
                  </TableCell>
                  <TableCell align="right">
                    {translate('app.hen_inventory.member_total')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byMember.map((row) => (
                  <TableRow key={row.memberId}>
                    <TableCell>{row.memberName}</TableCell>
                    <TableCell>{row.accountLabel}</TableCell>
                    <TableCell align="right">
                      {formatQty(row.slaughterQty)}
                    </TableCell>
                    <TableCell align="right">
                      {formatQty(row.transferQty)}
                    </TableCell>
                    <TableCell align="right">
                      {formatQty(row.transferQty)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2}>
                    <Typography sx={{ fontWeight: 600 }} variant="body2">
                      {translate('app.hen_inventory.totals_row')}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography sx={{ fontWeight: 600 }} variant="body2">
                      {formatQty(kpis.slaughterInPeriod)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography sx={{ fontWeight: 600 }} variant="body2">
                      {formatQty(kpis.transferInPeriod)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography sx={{ fontWeight: 600 }} variant="body2">
                      {formatQty(kpis.transferInPeriod)}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ReportScrollX>
        )}
      </Section>
    </Stack>
  );
}

function HenStockLineChart({
  timeseries,
  periods,
  alomNames,
  alomColors,
}: {
  timeseries: HenStockTimeseriesPoint[];
  periods: string[];
  alomNames: string[];
  alomColors: string[];
}) {
  const chartMetrics = useReportChartMetrics();
  return (
    <ReportScrollX
      minWidth={reportBarAreaMinWidth(periods.length, chartMetrics.narrow)}
    >
      <ChartsContainer
        height={chartMetrics.narrow ? 250 : 280}
        margin={chartMetrics.containerMargin}
        series={alomNames.map((name, index) => ({
          type: 'line' as const,
          id: name,
          label: name,
          data: timeseries.map((point) => point.byAlom[name] ?? 0),
          color: alomColors[index] ?? alomColors[0],
          curve: 'linear' as const,
          showMark: periods.length <= 31,
        }))}
        xAxis={[
          {
            id: 'period',
            data: periods,
            scaleType: 'band',
            tickLabelStyle: { fontSize: 11 },
          },
        ]}
        yAxis={[{ id: 'qty', width: chartMetrics.yAxisWidth, min: 0 }]}
      >
        <ChartsGrid horizontal />
        <LinePlot />
        <MarkPlot />
        <ChartsXAxis axisId="period" />
        <ChartsYAxis axisId="qty" />
        <ChartsLegend direction="horizontal" />
        <ChartsTooltip />
      </ChartsContainer>
    </ReportScrollX>
  );
}

function OutflowMemberBarChart({
  timeseries,
  members,
  mode,
  emptyLabel,
}: {
  timeseries: HenOutflowTimeseriesPoint[];
  members: HenMemberOutflowRow[];
  mode: 'slaughter' | 'transfer';
  emptyLabel: string;
}) {
  const activeMembers = members.filter((m) =>
    mode === 'slaughter' ? m.slaughterQty > 0 : m.transferQty > 0,
  );
  if (activeMembers.length === 0 || timeseries.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        {emptyLabel}
      </Typography>
    );
  }

  const periods = timeseries.map((p) => p.period);
  const field = mode === 'slaughter' ? 'slaughterByMember' : 'transferByMember';
  const chartMetrics = useReportChartMetrics();

  return (
    <ReportScrollX
      minWidth={reportBarAreaMinWidth(periods.length, chartMetrics.narrow)}
    >
      <ChartsContainer
        height={chartMetrics.narrow ? 250 : 280}
        margin={chartMetrics.containerMargin}
        series={activeMembers.map((member, index) => ({
          type: 'bar' as const,
          id: member.memberId,
          label: member.memberName,
          data: timeseries.map((point) => point[field][member.memberId] ?? 0),
          color: MEMBER_BAR_COLORS[index % MEMBER_BAR_COLORS.length],
        }))}
        xAxis={[
          {
            id: 'period',
            data: periods,
            scaleType: 'band',
            tickLabelStyle: { fontSize: 11 },
          },
        ]}
        yAxis={[{ id: 'qty', width: chartMetrics.yAxisWidth, min: 0 }]}
      >
        <ChartsGrid horizontal />
        <BarPlot />
        <ChartsXAxis axisId="period" />
        <ChartsYAxis axisId="qty" />
        <ChartsLegend direction="horizontal" />
        <ChartsTooltip />
      </ChartsContainer>
    </ReportScrollX>
  );
}

function KpiTile({ label, value }: { label: string; value: number }) {
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
        sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
        variant="h6"
      >
        {formatQty(value)}
        <Typography
          component="span"
          color="text.secondary"
          sx={{ ml: 0.5 }}
          variant="caption"
        >
          db
        </Typography>
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
            md: 'repeat(5, 1fr)',
          },
        }}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height={72} variant="rounded" />
        ))}
      </Box>
      <Skeleton height={280} variant="rounded" />
      <Skeleton height={160} variant="rounded" />
      <Skeleton height={280} variant="rounded" />
    </Stack>
  );
}
