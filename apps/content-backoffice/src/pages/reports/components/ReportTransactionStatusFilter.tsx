import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  type SxProps,
  type Theme,
} from '@mui/material';
import { useTranslate } from 'react-admin';

import type { ReportTransactionStatusFilter } from '../shared/reportTransactionStatus';

const OPTIONS: ReportTransactionStatusFilter[] = ['preview', 'draft', 'all'];

type Props = {
  value: ReportTransactionStatusFilter;
  onChange: (value: ReportTransactionStatusFilter) => void;
  sx?: SxProps<Theme>;
};

/** Shared MUI Select for report transaction publication scope (`draft` / `preview` / `all`). */
export function ReportTransactionStatusFilterControl({
  value,
  onChange,
  sx,
}: Props) {
  const translate = useTranslate();

  const handleChange = (
    event: SelectChangeEvent<ReportTransactionStatusFilter>,
  ) => {
    onChange(event.target.value as ReportTransactionStatusFilter);
  };

  return (
    <FormControl
      fullWidth
      size="small"
      sx={sx ?? { minWidth: 200, maxWidth: '100%' }}
    >
      <InputLabel id="report-transaction-status-filter-label">
        {translate('app.reports.transaction_status.label')}
      </InputLabel>
      <Select<ReportTransactionStatusFilter>
        label={translate('app.reports.transaction_status.label')}
        labelId="report-transaction-status-filter-label"
        onChange={handleChange}
        sx={{
          maxWidth: '100%',
          '& .MuiSelect-select': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        }}
        value={value}
        variant="filled"
      >
        {OPTIONS.map((option) => (
          <MenuItem key={option} value={option}>
            {translate(`app.reports.transaction_status.${option}`)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
