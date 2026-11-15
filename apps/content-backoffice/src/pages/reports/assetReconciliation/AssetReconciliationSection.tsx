import {
  Alert,
  Box,
  Chip,
  Link,
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
import { useTranslate } from 'react-admin';
import { Link as RouterLink } from 'react-router-dom';

import { ReportScrollX } from '../shared/reportLayout';
import { ASSET_RECONCILIATION_ITEM_CAP } from './constants';
import type { AssetReconciliationReport } from './types';
import type { AssetReconciliationStatus } from './useAssetReconciliation';

const amountFormat = new Intl.NumberFormat('hu-HU', {
  maximumFractionDigits: 2,
});

function formatAmount(value: number): string {
  return amountFormat.format(value);
}

function SubTitle({ children }: { children: string }) {
  return (
    <Typography component="h3" sx={{ mt: 2, mb: 0.5 }} variant="subtitle2">
      {children}
    </Typography>
  );
}

export function AssetReconciliationSection({
  status,
  report,
  errorMessage,
  asOf,
}: {
  status: AssetReconciliationStatus;
  report: AssetReconciliationReport | null;
  errorMessage: string | null;
  asOf: string;
}) {
  const translate = useTranslate();
  const t = (key: string, options?: Record<string, unknown>) =>
    translate(`app.reconciliation.fixed_assets.${key}`, options);

  return (
    <Paper
      data-testid="asset-reconciliation-section"
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
            {t('title')}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {t('subtitle', { date: asOf })}
          </Typography>
        </Box>
        {report ? (
          <Chip
            color={report.ok ? 'success' : 'warning'}
            label={report.ok ? t('ok') : t('mismatch')}
            size="small"
          />
        ) : null}
      </Stack>

      {status === 'loading' ? (
        <Skeleton height={120} variant="rounded" />
      ) : null}
      {status === 'error' ? (
        <Alert severity="error">{errorMessage}</Alert>
      ) : null}

      {report ? (
        <>
          {report.rows.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              {t('empty')}
            </Typography>
          ) : (
            <ReportScrollX>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('columns.currency')}</TableCell>
                    <TableCell align="right">{t('columns.ledger')}</TableCell>
                    <TableCell align="right">{t('columns.assets')}</TableCell>
                    <TableCell align="right">
                      {t('columns.difference')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.rows.map((row) => (
                    <TableRow key={row.currencyCode}>
                      <TableCell>{row.currencyCode}</TableCell>
                      <TableCell align="right">
                        {formatAmount(row.ledgerBalance)}
                      </TableCell>
                      <TableCell align="right">
                        {formatAmount(row.assetTotal)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: row.matched ? 'success.main' : 'warning.main',
                          fontWeight: 600,
                        }}
                      >
                        {formatAmount(row.difference)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ReportScrollX>
          )}

          <SubTitle>
            {t('unlinked_assets', { count: report.unlinkedAssets.length })}
          </SubTitle>
          {report.unlinkedAssets.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              {translate('app.reconciliation.empty_section')}
            </Typography>
          ) : (
            <ReportScrollX>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('columns.name')}</TableCell>
                    <TableCell>{t('columns.organization')}</TableCell>
                    <TableCell align="right">{t('columns.price')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.unlinkedAssets
                    .slice(0, ASSET_RECONCILIATION_ITEM_CAP)
                    .map((row) => (
                      <TableRow key={row.documentId}>
                        <TableCell>
                          <Link
                            component={RouterLink}
                            to={`/assets/${encodeURIComponent(row.documentId)}/show`}
                          >
                            {row.name || row.documentId}
                          </Link>
                        </TableCell>
                        <TableCell>{row.organizationName || '—'}</TableCell>
                        <TableCell align="right">
                          {row.purchasePrice == null
                            ? '—'
                            : `${formatAmount(row.purchasePrice)} ${row.currencyCode}`}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </ReportScrollX>
          )}

          <SubTitle>
            {t('unlinked_debits', { count: report.unlinkedDebits.length })}
          </SubTitle>
          {report.unlinkedDebits.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              {translate('app.reconciliation.empty_section')}
            </Typography>
          ) : (
            <ReportScrollX>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('columns.date')}</TableCell>
                    <TableCell>{t('columns.description')}</TableCell>
                    <TableCell>{t('columns.organization')}</TableCell>
                    <TableCell align="right">{t('columns.amount')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.unlinkedDebits
                    .slice(0, ASSET_RECONCILIATION_ITEM_CAP)
                    .map((row) => (
                      <TableRow key={row.documentId}>
                        <TableCell>{row.date ?? '—'}</TableCell>
                        <TableCell>
                          <Link
                            component={RouterLink}
                            to={`/transactions/${encodeURIComponent(row.documentId)}/show`}
                          >
                            {row.description || row.documentId}
                          </Link>
                        </TableCell>
                        <TableCell>{row.organizationName || '—'}</TableCell>
                        <TableCell align="right">
                          {`${formatAmount(row.amount)} ${row.currencyCode}`}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </ReportScrollX>
          )}

          {report.unlinkedAssets.length > ASSET_RECONCILIATION_ITEM_CAP ||
          report.unlinkedDebits.length > ASSET_RECONCILIATION_ITEM_CAP ? (
            <Typography color="text.secondary" variant="caption">
              {translate('app.reconciliation.capped', {
                cap: ASSET_RECONCILIATION_ITEM_CAP,
              })}
            </Typography>
          ) : null}
          {report.excludedTreasuryCount > 0 ? (
            <Typography
              color="text.secondary"
              component="p"
              sx={{ mt: 1 }}
              variant="caption"
            >
              {t('treasury_excluded', { count: report.excludedTreasuryCount })}
            </Typography>
          ) : null}
        </>
      ) : null}
    </Paper>
  );
}
