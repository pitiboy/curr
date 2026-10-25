import { describe, expect, it } from 'vitest';

import type { AccountChoice } from './accountCodes';
import {
  accountChoicesForProfile,
  EGG_DAILY_ENTRY_WORKFLOW_ID,
  filterAccountsByProfile,
  selectableAccountProfiles,
  selectableAccountProfilesWithAll,
} from './accountProfiles';

const accounts: AccountChoice[] = [
  { id: 'cash', code: '1000', name: 'Készpénz' },
  { id: 'private', code: '1001', name: 'Saját' },
  { id: 'stock', code: '1300', name: 'Készletek' },
  { id: 'revenue', code: '4000', name: 'Bevétel' },
  { id: 'egg-revenue', code: '4500', name: 'Tojás bevétel' },
  { id: 'material', code: '5000', name: 'Anyagköltség' },
];

describe('filterAccountsByProfile', () => {
  it('filters cost and revenue profiles symmetrically', () => {
    expect(
      filterAccountsByProfile(accounts, 'debit', 'cost').map((r) => r.code),
    ).toEqual(['5000']);
    expect(
      filterAccountsByProfile(accounts, 'credit', 'cost').map((r) => r.code),
    ).toEqual(['1000', '1001', '1300']);
    expect(
      filterAccountsByProfile(accounts, 'debit', 'revenue').map((r) => r.code),
    ).toEqual(['1000', '1001', '1300']);
    expect(
      filterAccountsByProfile(accounts, 'credit', 'revenue').map((r) => r.code),
    ).toEqual(['4000', '4500']);
  });

  it('supports egg production, internal, and sale account sets', () => {
    expect(
      filterAccountsByProfile(accounts, 'debit', 'egg-production').map(
        (r) => r.code,
      ),
    ).toEqual(['1300']);
    expect(
      filterAccountsByProfile(accounts, 'credit', 'egg-production').map(
        (r) => r.code,
      ),
    ).toEqual(['4500']);

    expect(
      filterAccountsByProfile(accounts, 'debit', 'egg-internal').map(
        (r) => r.code,
      ),
    ).toEqual(['1001']);
    expect(
      filterAccountsByProfile(accounts, 'credit', 'egg-internal').map(
        (r) => r.code,
      ),
    ).toEqual(['1300']);

    expect(
      filterAccountsByProfile(accounts, 'debit', 'egg-sale').map((r) => r.code),
    ).toEqual(['1000', '1001', '4000']);
    expect(
      filterAccountsByProfile(accounts, 'credit', 'egg-sale').map(
        (r) => r.code,
      ),
    ).toEqual(['1000', '1001', '1300']);
  });

  it('keeps an out-of-profile selection in the dropdown list', () => {
    const choices = accountChoicesForProfile(
      accounts,
      'credit',
      'cost',
      'revenue',
    );
    expect(choices.map((row) => row.id)).toContain('revenue');
  });
});

describe('selectableAccountProfiles', () => {
  it('always offers cost and revenue after config is ready', () => {
    expect(selectableAccountProfiles([], true)).toEqual(['cost', 'revenue']);
    expect(selectableAccountProfilesWithAll([], true)[0]).toBe('');
  });

  it('adds egg profiles only when egg-daily-entry is enabled', () => {
    expect(selectableAccountProfiles([EGG_DAILY_ENTRY_WORKFLOW_ID], true)).toEqual([
      'cost',
      'revenue',
      'egg-production',
      'egg-internal',
      'egg-sale',
    ]);
    expect(selectableAccountProfiles(['member-fee'], true)).toEqual([
      'cost',
      'revenue',
    ]);
  });

  it('hides egg profiles until config is ready', () => {
    expect(selectableAccountProfiles([EGG_DAILY_ENTRY_WORKFLOW_ID], false)).toEqual([
      'cost',
      'revenue',
    ]);
  });
});
