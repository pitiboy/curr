import {
  Alert,
  Autocomplete,
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
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Title, useTranslate } from 'react-admin';

import { ReportRangeFilterToolbar } from './components/ReportRangeFilterToolbar';
import {
  fetchProjectBalanceOrganizations,
  type OrganizationOption,
} from './projectBalance/projectBalance.fetch';
import {
  kpisForCurrency,
  projectTotalsForCurrency,
} from './projectBalance/projectBalance.helpers';
import type { ProjectBalanceReport } from './projectBalance/types';
import type { DateRangePreset } from './shared/reportDateRange';
import {
  REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
  type ReportTransactionStatusFilter,
} from './shared/reportTransactionStatus';
import { useProjectBalanceReport } from './projectBalance/useProjectBalanceReport';

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

export function ProjectBalanceReportPage() {
  const translate = useTranslate();
  const [range, setRange] = useState<DateRangePreset>('thisMonth');
  const [transactionStatus, setTransactionStatus] =
    useState<ReportTransactionStatusFilter>(
      REPORT_TRANSACTION_STATUS_FILTER_DEFAULT,
    );
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const { status, report, reload } = useProjectBalanceReport(
    range,
    transactionStatus,
    organizationId,
  );
  const [currency, setCurrency] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchProjectBalanceOrganizations()
      .then((rows) => {
        if (active) setOrganizations(rows);
      })
      .catch(() => {
        if (active) setOrganizations([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!report) return;
    setCurrency((prev) => {
      if (prev && report.currencies.includes(prev)) return prev;
      return report.historyCurrency;
    });
  }, [report]);

  const selectedOrg = useMemo(
    () =>
      organizations.find((row) => row.documentId === organizationId) ?? null,
    [organizationId, organizations],
  );

  return (
    <Box sx={{ p: 2, maxWidth: 1100 }}>
      <Title title="app.project_balance.title" />
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography component="h1" variant="h5">
          {translate('app.project_balance.title')}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {translate('app.project_balance.subtitle')}
        </Typography>
      </Stack>

      <ReportRangeFilterToolbar
        onRangeChange={setRange}
        onTransactionStatusChange={setTransactionStatus}
        range={range}
        transactionStatus={transactionStatus}
      >
        <Autocomplete
          onChange={(_e, value) => setOrganizationId(value?.documentId ?? null)}
          options={organizations}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(left, right) =>
            left.documentId === right.documentId
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label={translate('app.project_balance.project_filter')}
              size="small"
              sx={{ minWidth: 240 }}
            />
          )}
          size="small"
          value={selectedOrg}
        />
      </ReportRangeFilterToolbar>

      {status === 'loading' ? <ReportSkeleton /> : null}
      {status === 'error' ? (
        <Alert
          action={
            <Button color="inherit" onClick={reload} size="small">
              {translate('app.project_balance.retry')}
            </Button>
          }
          severity="error"
          variant="outlined"
        >
          {translate('app.project_balance.error')}
        </Alert>
      ) : null}
      {status === 'empty' ? (
        <Alert severity="info" variant="outlined">
          {translate('app.project_balance.empty')}
        </Alert>
      ) : null}
      {status === 'success' && report && currency ? (
        <>
          {report.loadTruncated ? (
            <Alert severity="warning" sx={{ mb: 2 }} variant="outlined">
              {translate('app.project_balance.warn_truncated')}
            </Alert>
          ) : null}
          {report.unclassifiedCount > 0 ? (
            <Alert severity="info" sx={{ mb: 2 }} variant="outlined">
              {translate('app.project_balance.warn_unclassified', {
                count: report.unclassifiedCount,
              })}
            </Alert>
          ) : null}
          <ReportBody
            currency={currency}
            onCurrencyChange={setCurrency}
            report={report}
          />
        </>
      ) : null}
    </Box>
  );
}

function ReportBody({
  report,
  currency,
  onCurrencyChange,
}: {
  report: ProjectBalanceReport;
  currency: string;
  onCurrencyChange: (value: string) => void;
}) {
  const translate = useTranslate();
  const theme = useTheme();
  const kpis = kpisForCurrency(report, currency);
  const history = report.historyByCurrency[currency] ?? [];
  const showCurrencyPicker = report.currencies.length > 1;

  const projectLabels = report.byProject.map((row) => row.orgName);
  const revenueByProject = report.byProject.map(
    (row) => projectTotalsForCurrency(row, currency)?.periodRevenue ?? 0,
  );
  const costByProject = report.byProject.map(
    (row) => projectTotalsForCurrency(row, currency)?.periodCost ?? 0,
  );

  return (
    <Stack spacing={3}>
      {showCurrencyPicker ? (
        <FormControl size="small" sx={{ maxWidth: 200 }}>
          <InputLabel id="project-balance-currency-label">
            {translate('app.project_balance.currency')}
          </InputLabel>
          <Select
            label={translate('app.project_balance.currency')}
            labelId="project-balance-currency-label"
            onChange={(event) => onCurrencyChange(event.target.value)}
            value={currency}
          >
            {report.currencies.map((code) => (
              <MenuItem key={code} value={code}>
                {code}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}

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
        <KpiTile
          label={translate('app.project_balance.kpi.cumulative', { currency })}
          valueLabel={formatMoney(kpis.cumulativeBalance, currency)}
        />
        <KpiTile
          label={translate('app.project_balance.kpi.period_revenue', {
            currency,
          })}
          valueLabel={formatMoney(kpis.periodRevenue, currency)}
        />
        <KpiTile
          label={translate('app.project_balance.kpi.period_cost', { currency })}
          valueLabel={formatMoney(kpis.periodCost, currency)}
        />
        <KpiTile
          label={translate('app.project_balance.kpi.period_net', { currency })}
          valueLabel={formatMoney(kpis.periodNet, currency)}
        />
      </Box>

      <Section
        title={translate('app.project_balance.by_project_title', { currency })}
      >
        <BarChart
          height={Math.max(280, report.byProject.length * 36)}
          margin={{ left: 72, right: 16, top: 24, bottom: 80 }}
          series={[
            {
              id: 'revenue',
              label: translate('app.project_balance.revenue'),
              data: revenueByProject,
              color: theme.palette.success.main,
            },
            {
              id: 'cost',
              label: translate('app.project_balance.cost'),
              data: costByProject,
              color: theme.palette.error.main,
            },
          ]}
          slotProps={{ legend: { direction: 'horizontal' } }}
          xAxis={[
            {
              data: projectLabels,
              scaleType: 'band',
              tickLabelStyle: { fontSize: 10, angle: 25, textAnchor: 'start' },
            },
          ]}
          yAxis={[{ width: 64 }]}
        />
      </Section>

      <Section
        title={translate('app.project_balance.history_title', { currency })}
      >
        {history.every((point) => point.revenue === 0 && point.cost === 0) ? (
          <Typography color="text.secondary" variant="body2">
            {translate('app.project_balance.history_empty')}
          </Typography>
        ) : (
          <BarChart
            height={320}
            margin={{ left: 72, right: 16, top: 24, bottom: 40 }}
            series={[
              {
                id: 'revenue',
                label: translate('app.project_balance.revenue'),
                data: history.map((point) => point.revenue),
                color: theme.palette.success.main,
              },
              {
                id: 'cost',
                label: translate('app.project_balance.cost'),
                data: history.map((point) => point.cost),
                color: theme.palette.error.main,
              },
            ]}
            slotProps={{ legend: { direction: 'horizontal' } }}
            xAxis={[
              {
                data: history.map((point) => point.period),
                scaleType: 'band',
                tickLabelStyle: { fontSize: 11 },
              },
            ]}
            yAxis={[{ width: 64 }]}
          />
        )}
      </Section>

      <Section title={translate('app.project_balance.table_title')}>
        <Paper sx={{ overflowX: 'auto' }} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  {translate('app.project_balance.col.project')}
                </TableCell>
                <TableCell align="right">
                  {translate('app.project_balance.col.period_revenue', {
                    currency,
                  })}
                </TableCell>
                <TableCell align="right">
                  {translate('app.project_balance.col.period_cost', {
                    currency,
                  })}
                </TableCell>
                <TableCell align="right">
                  {translate('app.project_balance.col.period_net', {
                    currency,
                  })}
                </TableCell>
                <TableCell align="right">
                  {translate('app.project_balance.col.cumulative', {
                    currency,
                  })}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.byProject.map((row) => {
                const totals = projectTotalsForCurrency(row, currency);
                if (!totals) return null;
                return (
                  <TableRow key={row.orgId}>
                    <TableCell>{row.orgName}</TableCell>
                    <TableCell align="right">
                      {formatMoney(totals.periodRevenue, currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatMoney(totals.periodCost, currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatMoney(totals.periodNet, currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatMoney(totals.cumulativeBalance, currency)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      </Section>
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography component="h2" sx={{ mb: 1.5 }} variant="subtitle1">
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function KpiTile({ label, valueLabel }: { label: string; valueLabel: string }) {
  return (
    <Paper sx={{ p: 1.5 }} variant="outlined">
      <Typography color="text.secondary" variant="caption">
        {label}
      </Typography>
      <Typography component="p" sx={{ fontWeight: 600 }} variant="h6">
        {valueLabel}
      </Typography>
    </Paper>
  );
}

function ReportSkeleton() {
  return (
    <Stack spacing={2}>
      <Skeleton height={48} variant="rounded" />
      <Skeleton height={200} variant="rounded" />
      <Skeleton height={320} variant="rounded" />
    </Stack>
  );
}
