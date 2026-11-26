import { describe, expect, it, vi } from 'vitest';

import {
  conflictGroups,
  eggEntriesUrl,
  parseEggEntriesError,
  postEggEntries,
  summarizeEggEntries,
  type EggConflict,
  type EggLegResult,
} from './eggEntriesApi';

function leg(partial: Partial<EggLegResult>): EggLegResult {
  return {
    key: 'k',
    kind: 'production',
    group: 'production',
    groupKey: 'org-a',
    label: 'A ól',
    action: 'insert',
    status: 'created',
    published: false,
    documentId: 'tx-1',
    existingDocumentId: null,
    existingAmount: null,
    relatedDocumentId: null,
    amount: 1,
    description: '',
    debitCode: null,
    creditCode: null,
    currencyCode: null,
    ...partial,
  };
}

describe('eggEntriesApi', () => {
  it('posts one JSON request (dry run as query flag)', async () => {
    const http = vi.fn(async () => ({ json: { data: { legs: [] } } }));
    await postEggEntries(http, 'https://api', '/api/egg-production/entries', {
      date: '2026-11-18',
      productions: [{ organizationId: 'org-a', quantity: 3 }],
      distributions: [],
    });
    expect(http).toHaveBeenCalledTimes(1);
    expect(http).toHaveBeenCalledWith(
      'https://api/api/egg-production/entries',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(eggEntriesUrl('https://api', '/x', { dryRun: true })).toBe(
      'https://api/x?dryRun=1',
    );
  });

  it('summarizes leg results per coop / member', () => {
    expect(
      summarizeEggEntries({
        legs: [
          leg({ key: 'a1' }),
          leg({ key: 'a2', status: 'updated', published: true }),
          leg({ key: 'a3', status: 'skipped' }),
          leg({
            key: 'm1',
            group: 'distribution',
            groupKey: 'm-anna',
            label: 'Anna',
          }),
        ],
      }),
    ).toEqual([
      {
        groupKey: 'org-a',
        group: 'production',
        label: 'A ól',
        created: 1,
        updated: 1,
        skipped: 1,
        published: true,
      },
      {
        groupKey: 'm-anna',
        group: 'distribution',
        label: 'Anna',
        created: 1,
        updated: 0,
        skipped: 0,
        published: false,
      },
    ]);
  });

  it('reads status, machine code, conflicts and label from the error body', () => {
    const conflict: EggConflict = {
      key: 'org-a:production',
      groupKey: 'org-a',
      group: 'production',
      label: 'A ól',
      kind: 'production',
      amount: 5,
      existingDocumentId: 'old',
      existingAmount: 4,
    };
    const parsed = parseEggEntriesError({
      status: 409,
      body: {
        error: {
          message: 'Már van rögzítés',
          details: {
            code: 'EGG_CONFLICT_CHOICE_REQUIRED',
            conflicts: [conflict, { ...conflict, key: 'org-a:pool-coop-out' }],
          },
        },
      },
    });
    expect(parsed).toMatchObject({
      status: 409,
      code: 'EGG_CONFLICT_CHOICE_REQUIRED',
      message: 'Már van rögzítés',
    });
    expect(conflictGroups(parsed.conflicts)).toEqual([
      { groupKey: 'org-a', label: 'A ól', existingAmount: 4, amount: 5 },
    ]);
    expect(parseEggEntriesError(new Error('network')).message).toBe('network');
  });
});
