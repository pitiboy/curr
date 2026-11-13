import { describe, expect, it } from 'vitest';

import { buildMembershipSharePieData } from './membershipShare.helpers';

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
