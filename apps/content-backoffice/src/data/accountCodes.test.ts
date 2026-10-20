import { describe, expect, it } from 'vitest';

import type { DataProvider } from 'react-admin';

import {
  CREDIT_CODES,
  DEBIT_CODES,
  filterAccountChoices,
  isCreditCode,
  isDebitCode,
  loadAllAccounts,
  parseCodeRegex,
  type AccountChoice,
} from './accountCodes';

const accounts: AccountChoice[] = [
  { id: 'cash', code: '1000', name: 'Készpénz' },
  { id: 'bank', code: '1100', name: 'Bankszámlák' },
  { id: 'receivable', code: '1200', name: 'Követelések' },
  { id: 'stock', code: '1300', name: 'Készletek' },
  { id: 'liability', code: '2000', name: 'Kötelezettségek' },
  { id: 'equity', code: '3000', name: 'Alaptőke' },
  { id: 'revenue', code: '4000', name: 'Értékesítés bevétele' },
  { id: 'material', code: '5000', name: 'Anyagköltség' },
  { id: 'wage', code: '5100', name: 'Bérköltség' },
  { id: 'other-expense', code: '5200', name: 'Egyéb igénybevett' },
  { id: 'services', code: '5400', name: 'Szolgáltatások' },
  { id: 'misc', code: '5800', name: 'Egyéb költségek' },
  { id: 'blank', code: null, name: 'Nincs kód' },
];

describe('parseCodeRegex', () => {
  const fallback = /^5/;

  it('keeps the fallback when the env value is missing', () => {
    expect(parseCodeRegex(undefined, fallback)).toBe(fallback);
    expect(parseCodeRegex('   ', fallback)).toBe(fallback);
  });

  it('accepts a slash-delimited regex and a bare pattern', () => {
    expect(parseCodeRegex('/^(1|3)/', fallback).source).toBe('^(1|3)');
    expect(parseCodeRegex('^5', fallback).test('5400')).toBe(true);
    expect(parseCodeRegex('/^5/i', fallback).flags).toBe('i');
  });
});

describe('account code filters', () => {
  it('uses /^5/ for debit when VITE_DEBIT_CODES is unset', () => {
    expect(DEBIT_CODES.source).toBe('^5');
    expect(
      filterAccountChoices(accounts, 'debit').map((row) => row.code),
    ).toEqual(['5000', '5100', '5200', '5400', '5800']);
    expect(isDebitCode('4000')).toBe(false);
    expect(isDebitCode('1000')).toBe(false);
  });

  it('uses /^(1|3)/ for credit when VITE_CREDIT_CODES is unset', () => {
    expect(CREDIT_CODES.source).toBe('^(1|3)');
    expect(
      filterAccountChoices(accounts, 'credit').map((row) => row.code),
    ).toEqual(['1000', '1100', '1200', '1300', '3000']);
    expect(isCreditCode('2000')).toBe(false);
    expect(isCreditCode('4000')).toBe(false);
    expect(isCreditCode('5000')).toBe(false);
  });
});

describe('loadAllAccounts', () => {
  it('follows pages so later expense codes are not dropped', async () => {
    const pages = [accounts.slice(0, 4), accounts.slice(4)];
    const getList: DataProvider['getList'] = async (_resource, params) => {
      const page = params.pagination?.page ?? 1;
      return {
        data: pages[page - 1] ?? [],
        total: accounts.length,
      };
    };

    const loaded = await loadAllAccounts(getList);
    expect(loaded).toHaveLength(accounts.length);
    expect(
      filterAccountChoices(loaded, 'debit').map((row) => row.code),
    ).toEqual(['5000', '5100', '5200', '5400', '5800']);
  });
});
