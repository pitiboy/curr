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
} from '@mui/material';
import { BarChart, BarPlot } from '@mui/x-charts/BarChart';
import { ChartsDataProvider } from '@mui/x-charts/ChartsDataProvider';
import { ChartsGrid } from '@mui/x-charts/ChartsGrid';
import { ChartsLegend } from '@mui/x-charts/ChartsLegend';
import { ChartsSurface } from '@mui/x-charts/ChartsSurface';
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip';
import { ChartsXAxis } from '@mui/x-charts/ChartsXAxis';
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis';
import { LinePlot, MarkPlot } from '@mui/x-charts/LineChart';
import { useState, type ReactNode } from 'react';
import { Title, useTranslate } from 'react-admin';

import { ReportTransactionStatusFilterControl } from './components/ReportTransactionStatusFilter';
import { usePoultryFlockReport } from './poultryFlock/usePoultryFlockReport';
import type {
  DateRangePreset,
  FlockCounts,
  FlockTimeseriesPoint,
  PoultryFlockReport,
} from './poultryFlock/types';
import {
  REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  type ReportTransactionStatusFilter as ReportTxStatusMode,
} from './shared/reportTransactionStatus';

const RANGE_PRESETS: DateRangePreset[] = [
  'all',
  'thisMonth',
  'lastMonth',
  'last7',
  'thisYear',
];

const CHART_MARGIN = { left: 52, right: 16, top: 28, bottom: 40 } as const;
const CHART_HEIGHT = 280;

const ALOM_COLORS = [
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

function formatPercent(rate: number | null): string {
  if (rate == null) return '—';
  return new Intl.NumberFormat('hu-HU', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(rate);
}

export function PoultryFlockReportPage() {
  const translate = useTranslate();
  const [range, setRange] = useState<DateRangePreset>('thisYear');
  const [transactionStatus, setTransactionStatus] =
    useState<ReportTxStatusMode>(REPORT_TRANSACTION_STATUS_FILTER_DEFAULT);
  const { status, report, reload } = usePoultryFlockReport(
    range,
    transactionStatus,
  );

  return (
    <Box sx={{ p: 2, maxWidth: 1100 }}>
      <Title title="app.poultry_flock.title" />
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography component="h1" variant="h5">
          {translate('app.poultry_flock.title')}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {translate('app.poultry_flock.subtitle')}
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
              {translate(`app.egg_inventory.range.${preset}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <ReportTransactionStatusFilterControl
          onChange={setTransactionStatus}
          value={transactionStatus}
        />
      </Stack>

      {status === 'loading' ? <ReportSkeleton /> : null}
      {status === 'error' ? (
        <Alert
          action={
            <Button color="inherit" onClick={reload} size="small">
              {translate('app.poultry_flock.retry')}
            </Button>
          }
          severity="error"
          variant="outlined"
        >
          {translate('app.poultry_flock.error')}
        </Alert>
      ) : null}
      {status === 'empty' ? (
        <Alert severity="info" variant="outlined">
          {translate('app.poultry_flock.empty')}
        </Alert>
      ) : null}
      {status === 'success' && report ? <ReportBody report={report} /> : null}
    </Box>
  );
}

function ReportBody({ report }: { report: PoultryFlockReport }) {
  const translate = useTranslate();
  const { kpis, timeseries, byAlom, alomNames } = report;
  const periods = timeseries.map((p) => p.period);
  const showOtherOut = kpis.otherOut.total > 0;

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(3, 1fr)',
            md: `repeat(${showOtherOut ? 6 : 5}, 1fr)`,
          },
        }}
      >
        <KpiTile
          counts={kpis.opening}
          label={translate('app.poultry_flock.kpi.opening')}
        />
        <KpiTile
          counts={kpis.added}
          label={translate('app.poultry_flock.kpi.added')}
        />
        <KpiTile
          counts={kpis.died}
          label={translate('app.poultry_flock.kpi.died')}
          warn={kpis.died.total > 0}
        />
        <KpiTile
          counts={kpis.slaughtered}
          label={translate('app.poultry_flock.kpi.slaughtered')}
        />
        {showOtherOut ? (
          <KpiTile
            counts={kpis.otherOut}
            label={translate('app.poultry_flock.kpi.other_out')}
          />
        ) : null}
        <KpiTile
          counts={kpis.closing}
          emphasize
          label={translate('app.poultry_flock.kpi.closing')}
        />
      </Box>

      <Section title={translate('app.poultry_flock.headcount_title')}>
        <HeadcountChart
          alomNames={alomNames}
          periods={periods}
          timeseries={timeseries}
          totalLabel={translate('app.poultry_flock.total')}
        />
      </Section>

      <Section title={translate('app.poultry_flock.animal_title')}>
        <AnimalSplitChart periods={periods} timeseries={timeseries} />
      </Section>

      <Section title={translate('app.poultry_flock.movements_title')}>
        <MovementsChart
          periods={periods}
          showOtherOut={showOtherOut}
          timeseries={timeseries}
        />
      </Section>

      <Section title={translate('app.poultry_flock.alom_title')}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  {translate('app.poultry_flock.alom_name')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.poultry_flock.kpi.opening')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.poultry_flock.kpi.added')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.poultry_flock.kpi.died')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.poultry_flock.kpi.slaughtered')}
                </TableCell>
                {showOtherOut ? (
                  <TableCell align="right">
                    {translate('app.poultry_flock.kpi.other_out')}
                  </TableCell>
                ) : null}
                <TableCell align="right">
                  {translate('app.poultry_flock.hen')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.poultry_flock.rooster')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.poultry_flock.kpi.closing')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.poultry_flock.mortality_rate')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {byAlom.map((row) => (
                <TableRow key={row.alomName}>
                  <TableCell>{row.alomName}</TableCell>
                  <TableCell align="right">{formatQty(row.opening)}</TableCell>
                  <TableCell align="right">{formatQty(row.added)}</TableCell>
                  <TableCell align="right">{formatQty(row.died)}</TableCell>
                  <TableCell align="right">
                    {formatQty(row.slaughtered)}
                  </TableCell>
                  {showOtherOut ? (
                    <TableCell align="right">
                      {formatQty(row.otherOut)}
                    </TableCell>
                  ) : null}
                  <TableCell align="right">
                    {formatQty(row.closingHen)}
                  </TableCell>
                  <TableCell align="right">
                    {formatQty(row.closingRooster)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatQty(row.closing)}
                  </TableCell>
                  <TableCell align="right">
                    {formatPercent(row.mortalityRate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Section>
    </Stack>
  );
}

function HeadcountChart({
  timeseries,
  periods,
  alomNames,
  totalLabel,
}: {
  timeseries: FlockTimeseriesPoint[];
  periods: string[];
  alomNames: string[];
  totalLabel: string;
}) {
  const theme = useTheme();
  return (
    <ChartsDataProvider
      height={CHART_HEIGHT}
      margin={CHART_MARGIN}
      series={[
        ...alomNames.map((name, index) => ({
          type: 'bar' as const,
          id: `alom-${name}`,
          label: name,
          data: timeseries.map((point) => point.headcountByAlom[name] ?? 0),
          stack: 'alom',
          color: ALOM_COLORS[index % ALOM_COLORS.length],
        })),
        {
          type: 'line' as const,
          id: 'headcount-total',
          label: totalLabel,
          data: timeseries.map((point) => point.headcount.total),
          color: theme.palette.text.primary,
          curve: 'linear' as const,
          showMark: periods.length <= 31,
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
      <ChartsLegend direction="horizontal" sx={{ justifyContent: 'center' }} />
      <ChartsSurface>
        <ChartsGrid horizontal />
        <BarPlot />
        <LinePlot />
        <MarkPlot />
        <ChartsXAxis axisId="period" />
        <ChartsYAxis axisId="qty" />
      </ChartsSurface>
      <ChartsTooltip />
    </ChartsDataProvider>
  );
}

function AnimalSplitChart({
  timeseries,
  periods,
}: {
  timeseries: FlockTimeseriesPoint[];
  periods: string[];
}) {
  const translate = useTranslate();
  const theme = useTheme();
  return (
    <BarChart
      height={CHART_HEIGHT}
      margin={CHART_MARGIN}
      series={[
        {
          id: 'hen',
          label: translate('app.poultry_flock.hen'),
          data: timeseries.map((p) => p.headcount.hen),
          stack: 'animal',
          color: theme.palette.primary.main,
        },
        {
          id: 'rooster',
          label: translate('app.poultry_flock.rooster'),
          data: timeseries.map((p) => p.headcount.rooster),
          stack: 'animal',
          color: theme.palette.warning.main,
        },
      ]}
      xAxis={[
        {
          data: periods,
          scaleType: 'band',
          tickLabelStyle: { fontSize: 11 },
        },
      ]}
      yAxis={[{ width: 48, min: 0 }]}
    />
  );
}

function MovementsChart({
  timeseries,
  periods,
  showOtherOut,
}: {
  timeseries: FlockTimeseriesPoint[];
  periods: string[];
  showOtherOut: boolean;
}) {
  const translate = useTranslate();
  const theme = useTheme();
  const series = [
    {
      id: 'added',
      label: translate('app.poultry_flock.kpi.added'),
      data: timeseries.map((p) => p.added),
      color: theme.palette.success.main,
    },
    {
      id: 'died',
      label: translate('app.poultry_flock.kpi.died'),
      data: timeseries.map((p) => p.died),
      color: theme.palette.error.main,
    },
    {
      id: 'slaughtered',
      label: translate('app.poultry_flock.kpi.slaughtered'),
      data: timeseries.map((p) => p.slaughtered),
      color: theme.palette.info.main,
    },
  ];
  if (showOtherOut) {
    series.push({
      id: 'otherOut',
      label: translate('app.poultry_flock.kpi.other_out'),
      data: timeseries.map((p) => p.otherOut),
      color: theme.palette.grey[500],
    });
  }
  return (
    <BarChart
      height={CHART_HEIGHT}
      margin={CHART_MARGIN}
      series={series}
      xAxis={[
        {
          data: periods,
          scaleType: 'band',
          tickLabelStyle: { fontSize: 11 },
        },
      ]}
      yAxis={[{ width: 48, min: 0 }]}
    />
  );
}

function KpiTile({
  label,
  counts,
  warn = false,
  emphasize = false,
}: {
  label: string;
  counts: FlockCounts;
  warn?: boolean;
  emphasize?: boolean;
}) {
  const translate = useTranslate();
  return (
    <Paper
      elevation={0}
      sx={{
        border: 1,
        borderColor: emphasize ? 'primary.main' : 'divider',
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
        {formatQty(counts.total)}
        <Typography
          component="span"
          color="text.secondary"
          sx={{ ml: 0.5 }}
          variant="caption"
        >
          db
        </Typography>
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ fontVariantNumeric: 'tabular-nums' }}
        variant="caption"
      >
        {translate('app.poultry_flock.split', {
          hen: formatQty(counts.hen),
          rooster: formatQty(counts.rooster),
        })}
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
          <Skeleton key={i} height={88} variant="rounded" />
        ))}
      </Box>
      <Skeleton height={280} variant="rounded" />
      <Skeleton height={280} variant="rounded" />
      <Skeleton height={160} variant="rounded" />
    </Stack>
  );
}
