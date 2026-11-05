import { Box } from '@mui/material';
import type { DateFieldProps } from 'react-admin';

type DateFieldFormat = Pick<DateFieldProps, 'locales' | 'options' | 'showTime'>;

export type TransactionDateParts = {
  date: string;
  time?: string;
};

/**
 * DateField props for the transaction screens.
 * Hungarian `hu-HU` always prints a period separator (`26. 10. 17.`).
 * `sv-SE` keeps year-month-day order and uses a hyphen instead.
 */
export function dateFieldProps(
  locale: string,
  showTime = false,
): DateFieldFormat {
  return {
    locales: locale === 'en' ? 'en' : 'sv-SE',
    showTime,
    options: showTime
      ? {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }
      : {
          year: '2-digit',
          month: '2-digit',
          day: '2-digit',
        },
  };
}

function parseDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Split formatted date and optional time for list cells that must not break mid-token. */
export function formatTransactionDateParts(
  value: unknown,
  locale: string,
  showTime = false,
): TransactionDateParts | null {
  const date = parseDate(value);
  if (!date) return null;

  const { locales, options } = dateFieldProps(locale, showTime);
  if (!showTime) {
    return { date: date.toLocaleDateString(locales, options) };
  }

  const dateText = date.toLocaleDateString(locales, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeText = date.toLocaleTimeString(locales, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return { date: dateText, time: timeText };
}

const partSx = { whiteSpace: 'nowrap' } as const;

/** Date on one line; time may wrap to the next line, never mid-date or mid-time. */
export function TransactionDateValue({
  value,
  locale,
  showTime = false,
  emptyText,
}: {
  value: unknown;
  locale: string;
  showTime?: boolean;
  emptyText?: string;
}) {
  const parts = formatTransactionDateParts(value, locale, showTime);
  if (!parts) {
    return emptyText ? <>{emptyText}</> : null;
  }

  return (
    <Box component="span" sx={{ display: 'inline-block' }}>
      <Box component="span" sx={partSx}>
        {parts.date}
      </Box>
      {parts.time ? (
        <>
          {' '}
          <Box component="span" sx={partSx}>
            {parts.time}
          </Box>
        </>
      ) : null}
    </Box>
  );
}
