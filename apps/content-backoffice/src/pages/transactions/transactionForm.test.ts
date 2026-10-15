import { describe, expect, it } from 'vitest';

import { transactionFormErrors } from './transactionForm';

const translate = (key: string) => key;

const filled = {
  date: '2026-10-15',
  amount: 10,
  currency_type: 'cur-1',
  organization: 'org-1',
  debit_account: 'deb-1',
  credit_account: 'cre-1',
  description: 'papír',
};

describe('transactionFormErrors', () => {
  it('blocks a save that leaves the required fields empty', () => {
    expect(transactionFormErrors({ description: 'csak leírás' }, [], translate)).toEqual({
      date: 'ra.validation.required',
      amount: 'ra.validation.required',
      currency_type: 'ra.validation.required',
      organization: 'ra.validation.required',
      debit_account: 'ra.validation.required',
      credit_account: 'ra.validation.required',
    });
  });

  it('accepts zero amount and an empty description', () => {
    expect(
      transactionFormErrors({ ...filled, amount: 0, description: '   ' }, [], translate),
    ).toEqual({});
  });

  it('requires a description and a vendor when a receipt file is attached', () => {
    const file = new File(['pdf'], 'bill.pdf');
    expect(
      transactionFormErrors(
        { ...filled, description: '' },
        [{ file, vendor: '', receiptTypeId: '' }],
        translate,
      ),
    ).toEqual({
      description: 'app.receipt_description_required',
      receipt_cards: 'app.receipt_card_required',
    });
  });
});
