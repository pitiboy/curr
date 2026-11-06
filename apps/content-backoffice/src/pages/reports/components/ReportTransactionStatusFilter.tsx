import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from '@mui/material';
import { useTranslate } from 'react-admin';

import type { ReportTransactionStatusFilter } from '../shared/reportTransactionStatus';

const OPTIONS: ReportTransactionStatusFilter[] = ['preview', 'draft', 'all'];

type Props = {
  value: ReportTransactionStatusFilter;
  onChange: (value: ReportTransactionStatusFilter) => void;
};

/** Shared MUI Select for report transaction publication scope (`draft` / `preview` / `all`). */
export function ReportTransactionStatusFilterControl({ value, onChange }: Props) {
  const translate = useTranslate();

  const handleChange = (event: SelectChangeEvent<ReportTransactionStatusFilter>) => {
    onChange(event.target.value as ReportTransactionStatusFilter);
  };

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel id="report-transaction-status-filter-label">
        {translate('app.reports.transaction_status.label')}
      </InputLabel>
      <Select<ReportTransactionStatusFilter>
        label={translate('app.reports.transaction_status.label')}
        labelId="report-transaction-status-filter-label"
        onChange={handleChange}
        value={value}
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
