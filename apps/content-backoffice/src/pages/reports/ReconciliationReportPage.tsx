import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
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
import { Title, useTranslate } from 'react-admin';

import { useOpenDrilldown } from '../../filters/globalTransactionFiltersAtom';
import { useBackofficeConfig } from '../../workflows/useBackofficeConfig';
import {
  ReportPageHeader,
  ReportPageShell,
  ReportScrollX,
} from './shared/reportLayout';
import {
  buildDraftTransactionsDrilldown,
  buildPublishedWithoutReceiptsDrilldown,
} from './reconciliation/drilldown';
import { publishedWithoutReceiptsFilterFromConfig } from './reconciliation/publishedWithoutReceiptsFilter';
import {
  RECONCILIATION_FEATURE_ID,
  type ReconciliationSection,
} from './reconciliation/types';
import { useReconciliationReport } from './reconciliation/useReconciliationReport';

function sectionTitleKey(sectionKey: string): string {
  return `app.reconciliation.sections.${sectionKey}`;
}

function itemColumns(section: ReconciliationSection): string[] {
  const keys = new Set<string>();
  for (const item of section.items) {
    for (const key of Object.keys(item)) {
      keys.add(key);
    }
  }
  return [...keys];
}

function formatCell(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

export function ReconciliationReportPage() {
  const translate = useTranslate();
  const openDrilldown = useOpenDrilldown();
  const { features } = useBackofficeConfig();
  const { report, loading, error, refresh } = useReconciliationReport();
  const publishedWithoutReceiptsFilter =
    publishedWithoutReceiptsFilterFromConfig(
      features[RECONCILIATION_FEATURE_ID]?.config,
    );

  function openSectionDrilldown(drilldown: string) {
    if (drilldown === 'draftTransactions') {
      openDrilldown(buildDraftTransactionsDrilldown());
      return;
    }
    if (drilldown === 'publishedWithoutReceipts') {
      openDrilldown(
        buildPublishedWithoutReceiptsDrilldown(publishedWithoutReceiptsFilter),
      );
    }
  }

  return (
    <ReportPageShell>
      <Title title={translate('app.reconciliation.title')} />
      <ReportPageHeader
        subtitle={translate('app.reconciliation.subtitle')}
        title={translate('app.reconciliation.title')}
      />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'flex-end',
          mb: 2,
        }}
      >
        <Button
          onClick={() => void refresh()}
          startIcon={<RefreshIcon />}
          variant="outlined"
        >
          {translate('app.reconciliation.refresh')}
        </Button>
      </Stack>

      <Alert
        icon={<FactCheckOutlinedIcon fontSize="inherit" />}
        severity="info"
        sx={{ mb: 2 }}
      >
        {translate('app.reconciliation.audit_retention_caveat', {
          days: report?.auditLogRetentionDays ?? 365,
        })}
      </Alert>

      {loading ? <Skeleton height={320} variant="rounded" /> : null}

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {report ? (
        <Stack spacing={2}>
          <Typography color="text.secondary" variant="caption">
            {translate('app.reconciliation.generated_at', {
              value: new Date(report.generatedAt).toLocaleString(),
            })}
          </Typography>
          {report.sections.map((section) => (
            <Paper
              key={section.key}
              sx={{ p: { xs: 1.5, sm: 2 } }}
              variant="outlined"
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  justifyContent: 'space-between',
                  mb: 1.5,
                }}
              >
                <Box>
                  <Typography component="h2" variant="subtitle1">
                    {translate(sectionTitleKey(section.key))}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {translate('app.reconciliation.count', {
                      count: section.count,
                    })}
                    {section.capped
                      ? ` — ${translate('app.reconciliation.capped', { cap: section.items.length })}`
                      : null}
                  </Typography>
                </Box>
                {section.drilldown === 'draftTransactions' ||
                section.drilldown === 'publishedWithoutReceipts' ? (
                  <Button
                    onClick={() => openSectionDrilldown(section.drilldown!)}
                    size="small"
                    variant="contained"
                  >
                    {translate('app.reconciliation.open_list')}
                  </Button>
                ) : null}
              </Stack>
              {section.count === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  {translate('app.reconciliation.empty_section')}
                </Typography>
              ) : (
                <ReportScrollX>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {itemColumns(section).map((col) => (
                          <TableCell key={col}>
                            {translate(`app.reconciliation.columns.${col}`, {
                              _: col,
                            })}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {section.items.map((item, index) => (
                        <TableRow key={`${section.key}-${index}`}>
                          {itemColumns(section).map((col) => (
                            <TableCell key={col}>
                              {formatCell(item[col])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ReportScrollX>
              )}
            </Paper>
          ))}
        </Stack>
      ) : null}
    </ReportPageShell>
  );
}
