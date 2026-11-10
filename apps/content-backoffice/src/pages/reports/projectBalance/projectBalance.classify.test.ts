import { describe, expect, it } from 'vitest';

import { classifyLedgerMovement } from './projectBalance.classify';

describe('classifyLedgerMovement', () => {
  it('detects cost and revenue rows', () => {
    expect(classifyLedgerMovement('5000', '1000')).toBe('cost');
    expect(classifyLedgerMovement('1300', '4000')).toBe('revenue');
    expect(classifyLedgerMovement('1101', '4200')).toBe('revenue');
  });

  it('recognizes import and workflow orientations', () => {
    expect(classifyLedgerMovement('1200', '4200')).toBe('revenue');
    expect(classifyLedgerMovement('4000', '1000')).toBe('revenue');
    expect(classifyLedgerMovement('4300', '1100')).toBe('revenue');
    expect(classifyLedgerMovement('1900', '4200')).toBe('revenue');
    expect(classifyLedgerMovement('1510', '1100')).toBe('cost');
  });

  it('skips internal transfers and mixed legs', () => {
    expect(classifyLedgerMovement('1000', '1100')).toBeNull();
    expect(classifyLedgerMovement('5000', '4000')).toBeNull();
    expect(classifyLedgerMovement('1900', '1100')).toBeNull();
  });
});
