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
  { id: 'bank', code: '1100', name: 'Bank' },
  { id: 'receivable', code: '1200', name: 'Követelés' },
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
    ).toEqual(['1000', '1001', '1100', '1200', '1300']);
    expect(
      filterAccountsByProfile(accounts, 'debit', 'revenue').map((r) => r.code),
    ).toEqual(['1000', '1001', '1100', '1200', '1300']);
    expect(
      filterAccountsByProfile(accounts, 'credit', 'revenue').map((r) => r.code),
    ).toEqual(['4000', '4500']);
  });

  it('filters investment: credit 10*/11*, debit other 1*', () => {
    expect(
      filterAccountsByProfile(accounts, 'credit', 'investment').map(
        (r) => r.code,
      ),
    ).toEqual(['1000', '1001', '1100']);
    expect(
      filterAccountsByProfile(accounts, 'debit', 'investment').map(
        (r) => r.code,
      ),
    ).toEqual(['1200', '1300']);
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
  it('always offers all, cost, revenue, and investment', () => {
    expect(selectableAccountProfiles()).toEqual([
      'cost',
      'revenue',
      'investment',
    ]);
    expect(selectableAccountProfilesWithAll()).toEqual([
      '',
      'cost',
      'revenue',
      'investment',
    ]);
  });
});
