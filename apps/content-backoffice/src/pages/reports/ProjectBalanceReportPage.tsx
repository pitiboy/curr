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
import type { BarItemIdentifier } from '@mui/x-charts/models';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Title, useTranslate } from 'react-admin';

import {
  useGlobalReportParams,
  useOpenDrilldown,
} from '../../filters/globalTransactionFiltersAtom';
import {
  fetchProjectBalanceOrganizations,
  type OrganizationOption,
} from './projectBalance/projectBalance.fetch';
import {
  kpisForCurrency,
  projectTotalsForCurrency,
} from './projectBalance/projectBalance.helpers';
import {
  drilldownForHistoryChart,
  drilldownForProjectChart,
  drilldownForTableCumulative,
  drilldownForTablePeriodAllLegs,
  drilldownForTablePeriodLeg,
  drilldownForTableProjectName,
  type ProjectBalanceDrilldownContext,
  type ProjectBalanceLeg,
} from './projectBalance/drilldown';
import type { ProjectBalanceReport } from './projectBalance/types';
import { useProjectBalanceReport } from './projectBalance/useProjectBalanceReport';
import {
  ReportPageHeader,
  ReportPageShell,
  ReportScrollX,
  reportBarAreaMinWidth,
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

export function ProjectBalanceReportPage() {
  const translate = useTranslate();
  // Date range + transaction status come from the global sidebar filters.
  const params = useGlobalReportParams();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const { status, report, reload } = useProjectBalanceReport(
    params,
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
    <ReportPageShell>
      <Title title="app.project_balance.title" />
      <ReportPageHeader
        subtitle={translate('app.project_balance.subtitle')}
        title={translate('app.project_balance.title')}
      />

      <Box sx={{ mb: 2, maxWidth: 360 }}>
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
              sx={{ minWidth: { xs: 0, sm: 240 }, width: '100%' }}
            />
          )}
          size="small"
          sx={{ maxWidth: '100%', width: { xs: '100%', sm: 360 } }}
          value={selectedOrg}
        />
      </Box>

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
            drilldownContext={{
              range: params.preset,
              bounds: params.bounds,
              transactionStatus: params.transactionStatus,
              currencyCode: currency,
              toolbarOrganizationId: organizationId,
            }}
            onCurrencyChange={setCurrency}
            report={report}
          />
        </>
      ) : null}
    </ReportPageShell>
  );
}

function ReportBody({
  report,
  currency,
  drilldownContext,
  onCurrencyChange,
}: {
  report: ProjectBalanceReport;
  currency: string;
  drilldownContext: ProjectBalanceDrilldownContext;
  onCurrencyChange: (value: string) => void;
}) {
  const translate = useTranslate();
  const theme = useTheme();
  const chartMetrics = useReportChartMetrics();
  // Drill-down: merge the link's filter into the global atom, then the list.
  const openDrilldown = useOpenDrilldown();

  const onBarClick = useCallback(
    (
      pick: (
        dataIndex: number,
        leg: ProjectBalanceLeg,
      ) => { pathname: '/transactions'; search: string },
    ) =>
      (_event: unknown, item: BarItemIdentifier) => {
        const seriesId = String(item.seriesId);
        if (seriesId !== 'revenue' && seriesId !== 'cost') return;
        openDrilldown(pick(item.dataIndex, seriesId));
      },
    [openDrilldown],
  );
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
        <FormControl
          size="small"
          sx={{
            maxWidth: { xs: '100%', sm: 200 },
            width: { xs: '100%', sm: 'auto' },
          }}
        >
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
        <ReportScrollX
          minWidth={reportBarAreaMinWidth(
            report.byProject.length,
            chartMetrics.narrow,
          )}
        >
          <BarChart
            height={Math.max(
              chartMetrics.narrow ? 260 : 280,
              report.byProject.length * (chartMetrics.narrow ? 30 : 36),
            )}
            margin={{
              left: chartMetrics.bandYAxisWidth,
              right: chartMetrics.narrow ? 8 : 16,
              top: 24,
              bottom: chartMetrics.narrow ? 96 : 80,
            }}
            onItemClick={onBarClick((dataIndex, leg) =>
              drilldownForProjectChart(
                drilldownContext,
                report.byProject[dataIndex]?.orgId ?? '',
                leg,
              ),
            )}
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
                tickLabelStyle: {
                  fontSize: chartMetrics.narrow ? 9 : 10,
                  angle: chartMetrics.narrow ? 35 : 25,
                  textAnchor: 'start',
                },
              },
            ]}
            yAxis={[{ width: chartMetrics.projectYAxisWidth }]}
          />
        </ReportScrollX>
      </Section>

      <Section
        title={translate('app.project_balance.history_title', { currency })}
      >
        {history.every((point) => point.revenue === 0 && point.cost === 0) ? (
          <Typography color="text.secondary" variant="body2">
            {translate('app.project_balance.history_empty')}
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
                left: chartMetrics.bandYAxisWidth,
                right: chartMetrics.narrow ? 8 : 16,
                top: 24,
                bottom: chartMetrics.narrow ? 56 : 40,
              }}
              onItemClick={onBarClick((dataIndex, leg) =>
                drilldownForHistoryChart(
                  drilldownContext,
                  history[dataIndex]?.period ?? '',
                  leg,
                ),
              )}
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
                  tickLabelStyle: { fontSize: chartMetrics.narrow ? 10 : 11 },
                },
              ]}
              yAxis={[{ width: chartMetrics.projectYAxisWidth }]}
            />
          </ReportScrollX>
        )}
      </Section>

      <Section title={translate('app.project_balance.table_title')}>
        <Paper sx={{ maxWidth: '100%', overflowX: 'auto' }} variant="outlined">
          <Table
            size="small"
            sx={{ minWidth: chartMetrics.narrow ? 520 : undefined }}
          >
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
                const drillTip = translate(
                  'app.project_balance.drilldown.hint',
                );
                return (
                  <TableRow key={row.orgId}>
                    <DrilldownCell
                      align="left"
                      onOpen={() =>
                        openDrilldown(
                          drilldownForTableProjectName(
                            drilldownContext,
                            row.orgId,
                          ),
                        )
                      }
                      title={drillTip}
                    >
                      {row.orgName}
                    </DrilldownCell>
                    <DrilldownCell
                      align="right"
                      onOpen={() =>
                        openDrilldown(
                          drilldownForTablePeriodLeg(
                            drilldownContext,
                            row.orgId,
                            'revenue',
                          ),
                        )
                      }
                      title={drillTip}
                    >
                      {formatMoney(totals.periodRevenue, currency)}
                    </DrilldownCell>
                    <DrilldownCell
                      align="right"
                      onOpen={() =>
                        openDrilldown(
                          drilldownForTablePeriodLeg(
                            drilldownContext,
                            row.orgId,
                            'cost',
                          ),
                        )
                      }
                      title={drillTip}
                    >
                      {formatMoney(totals.periodCost, currency)}
                    </DrilldownCell>
                    <DrilldownCell
                      align="right"
                      onOpen={() =>
                        openDrilldown(
                          drilldownForTablePeriodAllLegs(
                            drilldownContext,
                            row.orgId,
                          ),
                        )
                      }
                      title={drillTip}
                    >
                      {formatMoney(totals.periodNet, currency)}
                    </DrilldownCell>
                    <DrilldownCell
                      align="right"
                      onOpen={() =>
                        openDrilldown(
                          drilldownForTableCumulative(
                            drilldownContext,
                            row.orgId,
                          ),
                        )
                      }
                      title={drillTip}
                    >
                      {formatMoney(totals.cumulativeBalance, currency)}
                    </DrilldownCell>
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
