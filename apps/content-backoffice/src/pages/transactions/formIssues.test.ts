import { describe, expect, it } from 'vitest';

import {
  collectCreateIssues,
  collectFinalizeIssues,
  formIssueCounts,
  formIssueTone,
} from './formIssues';

const labels: Record<string, string> = {
  'resources.transactions.fields.date': 'Dátum',
  'resources.transactions.fields.amount': 'Összeg',
  'resources.transactions.fields.currency_type': 'Pénznem',
  'resources.transactions.fields.description': 'Leírás',
  'resources.transactions.fields.organization': 'Szervezet',
  'resources.transactions.fields.debit_account': 'Költség számla',
  'resources.transactions.fields.credit_account': 'Kifizető számla',
  'ra.validation.required': 'Kötelező',
  'app.receipt_card_required': 'Eladó és típus kötelező.',
  'app.transactions_finalize_pending': 'Mentetlen bizonylat.',
  'app.transactions_finalize_same_person': 'Saját rögzítés.',
  'app.transactions_finalize_no_receipt': 'Nincs bizonylat.',
  'app.transactions_create_no_receipt': 'Nincs bizonylat (create).',
};
const t = (key: string) => labels[key] ?? key;

const draftFilled = {
  date: '2026-10-15',
  amount: 10,
  currency_type: 'cur-1',
  description: 'papír',
};

const publishFilled = {
  ...draftFilled,
  organization: 'org-1',
  debit_account: 'deb-1',
  credit_account: 'cre-1',
};

describe('formIssueTone', () => {
  it('is warning with zero errors and error otherwise', () => {
    expect(formIssueTone(0)).toBe('warning');
    expect(formIssueTone(1)).toBe('error');
  });
});

describe('formIssueCounts', () => {
  it('counts levels separately', () => {
    expect(
      formIssueCounts([
        { level: 'error', message: 'a' },
        { level: 'warning', message: 'b' },
        { level: 'error', message: 'c' },
      ]),
    ).toEqual({ errors: 2, warnings: 1 });
  });
});

describe('collectFinalizeIssues', () => {
  it('lists missing publish fields as errors and no-receipt as warning', () => {
    expect(
      collectFinalizeIssues(
        draftFilled,
        {
          blocked: true,
          missingReceipt: true,
          samePersonBlocked: true,
        },
        t,
      ),
    ).toEqual([
      { level: 'error', message: 'Szervezet: Kötelező' },
      { level: 'error', message: 'Költség számla: Kötelező' },
      { level: 'error', message: 'Kifizető számla: Kötelező' },
      { level: 'error', message: 'Mentetlen bizonylat.' },
      { level: 'error', message: 'Saját rögzítés.' },
      { level: 'warning', message: 'Nincs bizonylat.' },
    ]);
  });

  it('returns empty when the publish form is complete and gates are clear', () => {
    expect(
      collectFinalizeIssues(
        publishFilled,
        {
          blocked: false,
          missingReceipt: false,
          samePersonBlocked: false,
        },
        t,
      ),
    ).toEqual([]);
  });
});

describe('collectCreateIssues', () => {
  it('lists missing draft fields as errors and no file as warning', () => {
    expect(collectCreateIssues({ description: 'x' }, [], t)).toEqual([
      { level: 'error', message: 'Dátum: Kötelező' },
      { level: 'error', message: 'Összeg: Kötelező' },
      { level: 'error', message: 'Pénznem: Kötelező' },
      { level: 'warning', message: 'Nincs bizonylat (create).' },
    ]);
  });

  it('flags invalid receipt cards without the empty-receipt warning', () => {
    const file = new File(['pdf'], 'bill.pdf');
    expect(
      collectCreateIssues(draftFilled, [{ file, vendor: '', receiptTypeId: '' }], t),
    ).toEqual([{ level: 'error', message: 'Eladó és típus kötelező.' }]);
  });

  it('is quiet on errors when the draft quartet is filled and a file is attached', () => {
    const file = new File(['pdf'], 'bill.pdf');
    expect(
      collectCreateIssues(
        draftFilled,
        [{ file, vendor: 'Bolt', receiptTypeId: 'type-1' }],
        t,
      ),
    ).toEqual([]);
  });
});
