import {
  Box,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
  type SxProps,
  type Theme,
} from '@mui/material';
import type { ReactNode } from 'react';

/** Responsive page chrome shared by all report routes. */
export function ReportPageShell({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        boxSizing: 'border-box',
        maxWidth: 1100,
        minWidth: 0,
        mx: 'auto',
        p: { xs: 1, sm: 2 },
        width: '100%',
      }}
    >
      {children}
    </Box>
  );
}

export function ReportPageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <Stack spacing={0.5} sx={{ mb: { xs: 1.5, sm: 2 } }}>
      <Typography
        component="h1"
        sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
        variant="h5"
      >
        {title}
      </Typography>
      <Typography color="text.secondary" variant="body2">
        {subtitle}
      </Typography>
    </Stack>
  );
}

const scrollX: SxProps<Theme> = {
  maxWidth: '100%',
  minWidth: 0,
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
};

/** Horizontal scroll for wide tables or chart canvases on narrow viewports. */
export function ReportScrollX({
  children,
  minWidth,
}: {
  children: ReactNode;
  minWidth?: number | string | Record<string, number | string>;
}) {
  return (
    <Box sx={scrollX}>
      <Box sx={minWidth != null ? { minWidth } : undefined}>{children}</Box>
    </Box>
  );
}

/** Minimum inner width so bar charts stay readable when the page scrolls sideways. */
export function reportBarAreaMinWidth(
  rowCount: number,
  narrow: boolean,
): number {
  const base = narrow ? 280 : 480;
  const perRow = narrow ? 28 : 36;
  return Math.max(base, rowCount * perRow);
}

export function useReportChartMetrics() {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('sm'));
  return {
    narrow,
    containerMargin: narrow
      ? ({ left: 40, right: 8, top: 16, bottom: 36 } as const)
      : ({ left: 52, right: 16, top: 28, bottom: 40 } as const),
    yAxisWidth: narrow ? 40 : 48,
    bandYAxisWidth: narrow ? 56 : 72,
    historyYAxisWidth: narrow ? 48 : 56,
    projectYAxisWidth: narrow ? 48 : 64,
  };
}
