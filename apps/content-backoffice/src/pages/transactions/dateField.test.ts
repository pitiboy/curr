import { describe, expect, it } from 'vitest';

import { dateFieldProps, formatTransactionDateParts } from './dateField';

describe('dateFieldProps', () => {
  const sample = new Date(Date.UTC(2026, 9, 17, 12, 26, 45));

  it('formats a Hungarian date with a hyphen', () => {
    const { locales, options, showTime } = dateFieldProps('hu');
    const text = sample.toLocaleDateString(locales, options);
    expect(showTime).toBe(false);
    expect(text).toBe('26-10-17');
    expect(text).not.toContain('.');
  });

  it('formats a Hungarian timestamp with a hyphen', () => {
    const { locales, options, showTime } = dateFieldProps('hu', true);
    const text = sample.toLocaleString(locales, options);
    expect(showTime).toBe(true);
    expect(text).not.toContain('.');
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('keeps the English slash separator', () => {
    const { locales, options } = dateFieldProps('en');
    const text = sample.toLocaleDateString(locales, options);
    expect(text).toBe('10/17/26');
    expect(text).not.toContain('.');
  });
});

describe('formatTransactionDateParts', () => {
  const sample = new Date(Date.UTC(2026, 9, 17, 12, 26, 45));

  it('returns only a date part without time', () => {
    expect(formatTransactionDateParts(sample, 'hu')).toEqual({
      date: '26-10-17',
    });
  });

  it('splits Hungarian date and time onto separate parts', () => {
    const parts = formatTransactionDateParts(sample, 'hu', true);
    expect(parts?.date).toBe('2026-10-17');
    expect(parts?.time).toMatch(/^\d{2}:\d{2}$/);
    expect(`${parts?.date} ${parts?.time}`).toBe(
      sample.toLocaleString('sv-SE', dateFieldProps('hu', true).options),
    );
  });

  it('returns null for empty values', () => {
    expect(formatTransactionDateParts(null, 'hu', true)).toBeNull();
    expect(formatTransactionDateParts('', 'hu')).toBeNull();
  });
});
