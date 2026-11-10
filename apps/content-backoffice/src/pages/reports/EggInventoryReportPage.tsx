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
import { PieChart } from '@mui/x-charts/PieChart';
import type { ReactNode } from 'react';
import { Title, useTranslate } from 'react-admin';

import {
  EGG_REPORT_ALOM_NAMES,
  memberTotal,
  producedInPeriod,
} from './eggInventory/eggInventory.mock';
import type {
  EggInventoryReport,
  EggMemberRow,
  EggTimeseriesPoint,
} from './eggInventory/types';
import { useGlobalReportParams } from '../../filters/globalTransactionFiltersAtom';
import { useEggInventoryReport } from './eggInventory/useEggInventoryReport';

const CHART_MARGIN = { left: 52, right: 16, top: 28, bottom: 40 } as const;
const CHART_HEIGHT = 280;

function formatQty(n: number): string {
  return new Intl.NumberFormat('hu-HU').format(n);
}

function formatMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${formatQty(n)} ${currency}`;
  }
}

export function EggInventoryReportPage() {
  const translate = useTranslate();
  // Date range + transaction status come from the global sidebar filters.
  const params = useGlobalReportParams();
  const { status, report, reload } = useEggInventoryReport(params);

  return (
    <Box sx={{ p: 2, maxWidth: 1100 }}>
      <Title title="app.egg_inventory.title" />
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography component="h1" variant="h5">
          {translate('app.egg_inventory.title')}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {translate('app.egg_inventory.subtitle')}
        </Typography>
      </Stack>

      {status === 'loading' ? <ReportSkeleton /> : null}
      {status === 'error' ? (
        <Alert
          action={
            <Button color="inherit" onClick={reload} size="small">
              {translate('app.egg_inventory.retry')}
            </Button>
          }
          severity="error"
          variant="outlined"
        >
          {translate('app.egg_inventory.error')}
        </Alert>
      ) : null}
      {status === 'empty' ? (
        <Alert severity="info" variant="outlined">
          {translate('app.egg_inventory.empty')}
        </Alert>
      ) : null}
      {status === 'success' && report ? <ReportBody report={report} /> : null}
    </Box>
  );
}

function ReportBody({ report }: { report: EggInventoryReport }) {
  const translate = useTranslate();
  const theme = useTheme();
  const { kpis, timeseries, byAlom, byMember } = report;
  const periods = timeseries.map((p) => p.period);
  const alomColors = [
    theme.palette.primary.main,
    theme.palette.info.main,
    theme.palette.success.main,
  ];

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(5, 1fr)',
          },
        }}
      >
        <KpiTile
          label={translate('app.egg_inventory.kpi.produced')}
          value={kpis.produced}
        />
        <KpiTile
          label={translate('app.egg_inventory.kpi.distributed')}
          value={kpis.distributed}
        />
        <KpiTile
          label={translate('app.egg_inventory.kpi.remaining')}
          value={kpis.remaining}
          warn={kpis.remaining < 0}
        />
        <KpiTile
          label={translate('app.egg_inventory.kpi.internal')}
          value={kpis.internalTotal}
        />
        <KpiTile
          label={translate('app.egg_inventory.kpi.sale')}
          value={kpis.saleTotal}
        />
      </Box>

      <Section title={translate('app.egg_inventory.timeseries_title')}>
        {timeseries.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            {translate('app.egg_inventory.empty')}
          </Typography>
        ) : (
          <ProductionBarTrendChart
            alomColors={alomColors}
            periods={periods}
            timeseries={timeseries}
            trendLabel={translate('app.egg_inventory.trend_total')}
          />
        )}
      </Section>

      <Section title={translate('app.egg_inventory.alom_title')}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{translate('app.egg_inventory.alom_name')}</TableCell>
              <TableCell align="right">
                {translate('app.egg_inventory.kpi.produced')}
              </TableCell>
              <TableCell align="right">
                {translate('app.egg_inventory.kpi.distributed')}
              </TableCell>
              <TableCell align="right">
                {translate('app.egg_inventory.kpi.remaining')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {byAlom.map((row) => (
              <TableRow key={row.alomName}>
                <TableCell>{row.alomName}</TableCell>
                <TableCell align="right">{formatQty(row.produced)}</TableCell>
                <TableCell align="right">
                  {formatQty(row.distributed)}
                </TableCell>
                <TableCell align="right">{formatQty(row.remaining)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title={translate('app.egg_inventory.members_title')}>
        <Typography color="text.secondary" sx={{ mb: 1.5 }} variant="body2">
          {translate('app.egg_inventory.members_subtitle')}
        </Typography>
        {byMember.length === 0 || timeseries.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            {translate('app.egg_inventory.empty')}
          </Typography>
        ) : (
          <Stack spacing={2}>
            <MemberTimelineChart
              members={byMember}
              periods={periods}
              timeseries={timeseries}
            />
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              }}
            >
              <MemberSharePie
                emptyLabel={translate('app.egg_inventory.pie_empty')}
                members={byMember}
                mode="internal"
                title={translate('app.egg_inventory.pie_internal')}
              />
              <MemberSharePie
                emptyLabel={translate('app.egg_inventory.pie_empty')}
                members={byMember}
                mode="sale"
                title={translate('app.egg_inventory.pie_sale')}
              />
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {translate('app.egg_inventory.member_name')}
                  </TableCell>
                  <TableCell>
                    {translate('app.egg_inventory.member_account')}
                  </TableCell>
                  <TableCell align="right">
                    {translate('app.egg_inventory.kpi.internal')}
                  </TableCell>
                  <TableCell align="right">
                    {translate('app.egg_inventory.sale_qty')}
                  </TableCell>
                  <TableCell align="right">
                    {translate('app.egg_inventory.sale_revenue')}
                  </TableCell>
                  <TableCell align="right">
                    {translate('app.egg_inventory.member_total')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byMember.map((row) => (
                  <TableRow key={row.memberId}>
                    <TableCell>{row.memberName}</TableCell>
                    <TableCell>
                      <Typography
                        component="span"
                        sx={{ fontVariantNumeric: 'tabular-nums' }}
                        variant="body2"
                      >
                        {row.accountLabel}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatQty(row.internalQty)}
                    </TableCell>
                    <TableCell align="right">
                      {formatQty(row.saleQty)}
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        component="span"
                        sx={{ fontVariantNumeric: 'tabular-nums' }}
                        variant="body2"
                      >
                        {row.saleQty > 0
                          ? formatMoney(row.saleRevenue, row.saleCurrency)
                          : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatQty(memberTotal(row))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        )}
      </Section>
    </Stack>
  );
}

function ProductionBarTrendChart({
  timeseries,
  periods,
  alomColors,
  trendLabel,
}: {
  timeseries: EggTimeseriesPoint[];
  periods: string[];
  alomColors: string[];
  trendLabel: string;
}) {
  const theme = useTheme();
  const totals = timeseries.map(producedInPeriod);

  return (
    <ChartsContainer
      height={CHART_HEIGHT}
      margin={CHART_MARGIN}
      series={[
        ...EGG_REPORT_ALOM_NAMES.map((name, index) => ({
          type: 'bar' as const,
          id: name,
          label: name,
          data: timeseries.map((point) => point.byAlom[name] ?? 0),
          stack: 'alom',
          color: alomColors[index] ?? theme.palette.primary.main,
        })),
        {
          type: 'line' as const,
          id: 'trend-total',
          label: trendLabel,
          data: totals,
          color: theme.palette.text.primary,
          curve: 'linear' as const,
          showMark: true,
        },
      ]}
      xAxis={[
        {
          id: 'period',
          data: periods,
          scaleType: 'band',
          tickLabelStyle: { fontSize: 11 },
        },
      ]}
      yAxis={[{ id: 'qty', width: 48, min: 0 }]}
    >
      <ChartsGrid horizontal />
      <BarPlot />
      <LinePlot />
      <MarkPlot />
      <ChartsXAxis axisId="period" />
      <ChartsYAxis axisId="qty" />
      <ChartsLegend direction="horizontal" />
      <ChartsTooltip />
    </ChartsContainer>
  );
}

const MEMBER_BAR_COLORS = [
  '#346C3E',
  '#C47B2C',
  '#2F6F8F',
  '#8B5A2B',
  '#5C6B4A',
  '#A65D57',
] as const;

function MemberTimelineChart({
  timeseries,
  periods,
  members,
}: {
  timeseries: EggTimeseriesPoint[];
  periods: string[];
  members: EggMemberRow[];
}) {
  return (
    <ChartsContainer
      height={CHART_HEIGHT}
      margin={CHART_MARGIN}
      series={members.map((member, index) => ({
        type: 'bar' as const,
        id: member.memberId,
        label: member.memberName,
        data: timeseries.map(
          (point) => point.byMemberTotal[member.memberId] ?? 0,
        ),
        // No stack → grouped bars side-by-side per period.
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
      yAxis={[{ id: 'qty', width: 48, min: 0 }]}
    >
      <ChartsGrid horizontal />
      <BarPlot />
      <ChartsXAxis axisId="period" />
      <ChartsYAxis axisId="qty" />
      <ChartsLegend direction="horizontal" />
      <ChartsTooltip />
    </ChartsContainer>
  );
}

function MemberSharePie({
  title,
  members,
  mode,
  emptyLabel,
}: {
  title: string;
  members: EggMemberRow[];
  mode: 'internal' | 'sale';
  emptyLabel: string;
}) {
  const data = members
    .map((row) => ({
      id: row.memberId,
      label: row.memberName,
      value: mode === 'internal' ? row.internalQty : row.saleQty,
    }))
    .filter((row) => row.value > 0);

  return (
    <Box>
      <Typography sx={{ mb: 0.5 }} variant="subtitle2">
        {title}
      </Typography>
      {data.length === 0 ? (
        <Typography color="text.secondary" variant="body2">
          {emptyLabel}
        </Typography>
      ) : (
        <PieChart
          height={240}
          margin={{ top: 8, bottom: 8, left: 8, right: 8 }}
          series={[
            {
              data,
              innerRadius: 36,
              outerRadius: 88,
              paddingAngle: 1,
              cornerRadius: 2,
              arcLabel: (item) =>
                item.value >= Math.max(...data.map((d) => d.value)) * 0.12
                  ? `${item.value}`
                  : '',
              arcLabelMinAngle: 18,
              valueFormatter: (item) => `${formatQty(item.value)} db`,
            },
          ]}
          slotProps={{
            legend: {
              direction: 'horizontal',
              position: { vertical: 'bottom', horizontal: 'center' },
            },
          }}
        />
      )}
    </Box>
  );
}

function KpiTile({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
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
        color={warn ? 'warning.main' : 'text.primary'}
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
            sm: 'repeat(3, 1fr)',
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
      <Skeleton height={240} variant="rounded" />
    </Stack>
  );
}
