import { Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslate } from 'react-admin';

import {
  REPORT_RANGE_PRESETS,
  type DateRangePreset,
} from '../shared/reportDateRange';
import { type ReportTransactionStatusFilter } from '../shared/reportTransactionStatus';
import { ReportTransactionStatusFilterControl } from './ReportTransactionStatusFilter';

type Props = {
  range: DateRangePreset;
  onRangeChange: (value: DateRangePreset) => void;
  transactionStatus: ReportTransactionStatusFilter;
  onTransactionStatusChange: (value: ReportTransactionStatusFilter) => void;
  /** Extra controls (e.g. membership ledger focus) rendered after the status filter. */
  children?: ReactNode;
};

/** Shared date-range presets + transaction publication filter for report pages. */
export function ReportRangeFilterToolbar({
  range,
  onRangeChange,
  transactionStatus,
  onTransactionStatusChange,
  children,
}: Props) {
  const translate = useTranslate();

  return (
    <Stack
      alignItems={{ xs: 'stretch', sm: 'center' }}
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      sx={{ mb: { xs: 1.5, sm: 2 }, flexWrap: 'wrap', width: '100%' }}
    >
      <ToggleButtonGroup
        color="primary"
        exclusive
        onChange={(_e, value: DateRangePreset | null) => {
          if (value) onRangeChange(value);
        }}
        size="small"
        sx={{
          flexWrap: 'wrap',
          maxWidth: '100%',
          '& .MuiToggleButton-root': {
            flex: { xs: '1 1 auto', sm: '0 1 auto' },
            minWidth: 0,
            px: { xs: 1, sm: 1.5 },
          },
        }}
        value={range}
      >
        {REPORT_RANGE_PRESETS.map((preset) => (
          <ToggleButton key={preset} value={preset}>
            {translate(`app.reports.range.${preset}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <ReportTransactionStatusFilterControl
        onChange={onTransactionStatusChange}
        value={transactionStatus}
      />

      {children}
    </Stack>
  );
}
