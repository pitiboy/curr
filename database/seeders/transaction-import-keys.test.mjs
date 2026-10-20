import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACCOUNT_ALIASES,
  bookRow,
  buildTransactions,
  excelAmount,
  excelDate,
  memberIdentifierBase,
  resolveAccountLabel,
  resolveOrganization,
  resolveTransactionType,
} from './transaction-import-keys.mjs';

const accounts = new Set([
  'Készpénz',
  'Bankszámlák',
  'Belterületi földterületek',
  'Mezőgazdasági földterületek',
  'Szolgáltatások',
  'Anyagköltség',
  'Részjegytőke',
  'Pénzügyi bevételek',
]);
const orgs = new Set(['Zöld források szövetkezet @Szupatak', 'I/4.11.1 Birtokkezelés']);
const types = new Set(['Készpénz', 'Utalás', 'Bányászás']);

const source = {
  currencyCode: 'HUF',
  mainOrganization: 'Zöld források szövetkezet @Szupatak',
  projectOrganizations: { 'Zöld Élet Program': 'Zöld források szövetkezet @Szupatak' },
  partyAccounts: { Pénztár: 'Készpénz', Bank: 'Bankszámlák' },
  operationCreditAccounts: { Részjegy: 'Részjegytőke', Kamat: 'Pénzügyi bevételek' },
  expenseDebitAccounts: { Anyag: 'Anyagköltség' },
  placeTransactionTypes: { kp: 'Készpénz', 'K&H': 'Utalás' },
  operationTransactionTypes: { Bányászás: 'Bányászás' },
  import_key_fields: ['currency', 'date', 'amount', 'payer', 'payee', 'project'],
};

describe('resolveAccountLabel', () => {
  it('keeps a chart name and maps sheet aliases', () => {
    assert.equal(resolveAccountLabel('Bankszámlák', accounts), 'Bankszámlák');
    assert.equal(resolveAccountLabel('Lakó földterületek', accounts), 'Belterületi földterületek');
    assert.equal(resolveAccountLabel('Földterületek', accounts), 'Mezőgazdasági földterületek');
    assert.equal(resolveAccountLabel('Pénztár - Saját számla', accounts), 'Készpénz');
    assert.equal(ACCOUNT_ALIASES['Gazdasági földterületek'], 'Mezőgazdasági földterületek');
  });

  it('turns member labels into tag and saját refs', () => {
    assert.equal(memberIdentifierBase('Pál'), 'pál');
    assert.equal(resolveAccountLabel('Pál - Tagi számla', accounts), 'tag:pál');
    assert.equal(resolveAccountLabel('Pál – Tagi számla', accounts), 'tag:pál');
    assert.equal(resolveAccountLabel('Ildikó - Saját számla', accounts), 'saját:ildikó');
  });

  it('rejects a label that is not on the chart', () => {
    assert.throws(() => resolveAccountLabel('Alaptőke', accounts), /no chart account/);
  });
});

describe('resolveOrganization', () => {
  it('uses the organization name, and the project table otherwise', () => {
    assert.equal(resolveOrganization('I/4.11.1 Birtokkezelés', source, orgs), 'I/4.11.1 Birtokkezelés');
    assert.equal(
      resolveOrganization('Zöld Élet Program', source, orgs),
      'Zöld források szövetkezet @Szupatak',
    );
  });
});

describe('resolveTransactionType', () => {
  it('lets the operation win over the place', () => {
    assert.equal(
      resolveTransactionType({ row: 1, operation: 'Bányászás', place: 'K&H' }, source, types),
      'Bányászás',
    );
    assert.equal(resolveTransactionType({ row: 1, operation: 'Költség', place: 'kp' }, source, types), 'Készpénz');
    assert.equal(resolveTransactionType({ row: 1, operation: 'Költség', place: 'Szúpatak' }, source, types), null);
  });
});

describe('buildTransactions', () => {
  it('books the row and keeps a stable key', () => {
    const row = {
      row: 2,
      date: '2024-11-13',
      payer: 'Pál',
      payee: 'Pénztár',
      ledger: 'Szövetkezet',
      project: 'I/4.11.1 Birtokkezelés',
      purpose: 'Részjegy',
      operation: 'Költség',
      amount: 30000,
      place: 'kp',
      description: 'Ügyvéd',
      credit_label: 'Pál - Tagi számla',
      debit_label: 'Szolgáltatások',
    };
    assert.equal(excelDate(45609), '2024-11-13');
    assert.equal(excelAmount('-25370'), -25370);
    const built = buildTransactions(source, { accountNames: accounts, orgNames: orgs, typeNames: types }, [row]);
    assert.equal(built.transactions[0].credit_account, 'tag:pál');
    assert.equal(built.transactions[0].debit_account, 'Szolgáltatások');
    assert.equal(built.transactions[0].organization, 'I/4.11.1 Birtokkezelés');
    assert.equal(built.transactions[0].transaction_type, 'Készpénz');
    assert.match(built.transactions[0].import_key, /^excel:[0-9a-f]{20}$/);
    const again = buildTransactions(
      { ...source, transactions: built.transactions },
      { accountNames: accounts, orgNames: orgs, typeNames: types },
    );
    assert.deepEqual(again.transactions, built.transactions);
  });

  it('books a row through bookRow', () => {
    const booked = bookRow(
      {
        row: 14,
        project: 'Zöld Élet Program',
        operation: 'Befizetés',
        place: 'kp',
        credit_label: 'Péter - Tagi számla',
        debit_label: 'Pénztár - Saját számla',
      },
      source,
      { accountNames: accounts, orgNames: orgs, typeNames: types },
    );
    assert.equal(booked.credit_account, 'tag:péter');
    assert.equal(booked.debit_account, 'Készpénz');
    assert.equal(booked.organization, 'Zöld források szövetkezet @Szupatak');
  });
});
