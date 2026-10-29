import type { DateFieldProps } from 'react-admin';

type DateFieldFormat = Pick<DateFieldProps, 'locales' | 'options' | 'showTime'>;

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
