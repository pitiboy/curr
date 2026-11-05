import { describe, expect, it } from 'vitest';

import type { AccountChoice } from './accountCodes';
import {
  accountChoicesForProfile,
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

  it('keeps an out-of-profile selection in the dropdown list', () => {
    const choices = accountChoicesForProfile(
      accounts,
      'credit',
      'cost',
      'revenue',
    );
    expect(choices.map((row) => row.id)).toContain('revenue');
  });

  it('restricts choices to an exact ledger code when provided', () => {
    const withDupes: AccountChoice[] = [
      ...accounts,
      { id: 'private-2', code: '1001', name: 'Másik saját' },
    ];
    const choices = accountChoicesForProfile(
      withDupes,
      'credit',
      '',
      '',
      undefined,
      '1001',
    );
    expect(choices.map((row) => row.code)).toEqual(['1001', '1001']);
    expect(choices.map((row) => row.id).sort()).toEqual([
      'private',
      'private-2',
    ]);
  });
});

describe('selectableAccountProfiles', () => {
  it('always offers all, cost, and revenue', () => {
    expect(selectableAccountProfiles()).toEqual(['cost', 'revenue']);
    expect(selectableAccountProfilesWithAll()).toEqual(['', 'cost', 'revenue']);
  });
});
