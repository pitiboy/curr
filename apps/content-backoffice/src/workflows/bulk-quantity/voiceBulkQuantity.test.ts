import { describe, expect, it, vi } from 'vitest';

import {
  mapVoiceEggParseToBulk,
  parseVoiceEggTranscript,
  type VoiceEggParseResult,
} from './voiceBulkQuantity';

function result(
  overrides: Partial<VoiceEggParseResult> = {},
): VoiceEggParseResult {
  return {
    date: '2026-11-17',
    production: [
      { organizationId: 'house-1', amount: 40 },
      { organizationId: 'house-2', amount: 12 },
    ],
    distribution: [
      { memberId: 'mem-1', amount: 30 },
      { memberId: 'mem-2', amount: 22 },
    ],
    confidence: 0.9,
    low_confidence_fields: [],
    warnings: [],
    labels: {
      production: { 'house-1': '1. ól' },
      distribution: { 'mem-1': 'Peti' },
    },
    ...overrides,
  };
}

describe('mapVoiceEggParseToBulk', () => {
  it('maps production and distribution amounts to string inputs', () => {
    const plan = mapVoiceEggParseToBulk(result());
    expect(plan.date).toBe('2026-11-17');
    expect(plan.quantities).toEqual({
      'house-1': '40',
      'house-2': '12',
    });
    expect(plan.memberQuantities).toEqual({
      'mem-1': '30',
      'mem-2': '22',
    });
    expect(plan.filledProductionIds).toEqual(['house-1', 'house-2']);
    expect(plan.filledDistributionIds).toEqual(['mem-1', 'mem-2']);
    expect(plan.lowConfidenceProduction).toBe(false);
    expect(plan.warnings).toEqual([]);
  });

  it('flags all sections when overall confidence is low', () => {
    const plan = mapVoiceEggParseToBulk(result({ confidence: 0.4 }));
    expect(plan.lowConfidenceDate).toBe(true);
    expect(plan.lowConfidenceProduction).toBe(true);
    expect(plan.lowConfidenceDistribution).toBe(true);
  });

  it('skips non-positive or incomplete rows', () => {
    const plan = mapVoiceEggParseToBulk(
      result({
        production: [
          { organizationId: 'house-1', amount: 0 },
          { organizationId: '', amount: 5 },
          { organizationId: 'house-2', amount: 7.6 },
        ],
        distribution: [{ memberId: 'mem-1', amount: -1 }],
      }),
    );
    expect(plan.quantities).toEqual({ 'house-2': '8' });
    expect(plan.memberQuantities).toEqual({});
  });
});

describe('parseVoiceEggTranscript', () => {
  it('posts workflowId and returns the egg payload', async () => {
    const httpClient = vi.fn(async () => ({
      json: { data: result() },
    }));
    const data = await parseVoiceEggTranscript(httpClient, 'http://api', {
      transcript: 'Ma 40 tojás az 1. ólban',
      organizationId: 'org-poultry',
      workflowId: 'egg-production',
    });
    expect(httpClient).toHaveBeenCalledWith(
      'http://api/api/transactions/parse-voice',
      {
        method: 'POST',
        body: JSON.stringify({
          transcript: 'Ma 40 tojás az 1. ólban',
          organizationId: 'org-poultry',
          workflowId: 'egg-production',
        }),
      },
    );
    expect(data.production).toHaveLength(2);
  });
});
