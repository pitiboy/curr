import { describe, expect, it } from 'vitest';

import {
  buildMembershipSharePieData,
  stackedBarAxisDomain,
} from './membershipShare.helpers';

describe('stackedBarAxisDomain', () => {
  it('extends max to stacked totals so a short series is not clipped', () => {
    expect(
      stackedBarAxisDomain([
        [13_516_280, 12_000_000],
        [1_567_204.68, 400_000],
      ]),
    ).toEqual({
      min: 0,
      max: 13_516_280 + 1_567_204.68,
    });
  });

  it('keeps room for negative segments', () => {
    expect(stackedBarAxisDomain([[1_000_000], [-200_000]])).toEqual({
      min: -200_000,
      max: 1_000_000,
    });
  });
});

describe('buildMembershipSharePieData', () => {
  it('keeps negative pocket with abs slice size', () => {
    const pie = buildMembershipSharePieData([
      {
        id: 'share',
        label: '1101 részjegy',
        amount: 12_000_000,
        color: '#0a0',
      },
      {
        id: 'pocket',
        label: '1001 zseb',
        amount: -3_500_000,
        color: '#f80',
      },
    ]);

    expect(pie).toEqual([
      {
        id: 'share',
        label: '1101 részjegy',
        value: 12_000_000,
        signedValue: 12_000_000,
        color: '#0a0',
      },
      {
        id: 'pocket',
        label: '1001 zseb',
        value: 3_500_000,
        signedValue: -3_500_000,
        color: '#f80',
      },
    ]);
  });

  it('drops zero amounts', () => {
    const pie = buildMembershipSharePieData([
      { id: 'share', label: 'share', amount: 100, color: '#0a0' },
      { id: 'pocket', label: 'pocket', amount: 0, color: '#f80' },
    ]);

    expect(pie).toHaveLength(1);
    expect(pie[0]?.id).toBe('share');
  });
});
