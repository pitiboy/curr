import { describe, expect, it } from 'vitest';

import { reportBarAreaMinWidth } from './reportLayout';

describe('reportBarAreaMinWidth', () => {
  it('uses a mobile floor and grows with row count', () => {
    expect(reportBarAreaMinWidth(0, true)).toBe(280);
    expect(reportBarAreaMinWidth(12, true)).toBe(12 * 28);
    expect(reportBarAreaMinWidth(4, false)).toBe(480);
    expect(reportBarAreaMinWidth(20, false)).toBe(20 * 36);
  });
});
