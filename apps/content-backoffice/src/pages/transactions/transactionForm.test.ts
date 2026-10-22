import { describe, expect, it } from 'vitest';

import {
  transactionFormErrors,
  transactionPublishFormErrors,
} from './transactionForm';

const translate = (key: string) => key;

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

describe('transactionFormErrors', () => {
  it('blocks a save that leaves the draft quartet empty', () => {
    expect(
      transactionFormErrors({ description: 'csak leírás' }, [], translate),
    ).toEqual({
      date: 'ra.validation.required',
      amount: 'ra.validation.required',
      currency_type: 'ra.validation.required',
    });
  });

  it('accepts a draft without organization or accounts when the quartet is filled', () => {
    expect(transactionFormErrors({ ...draftFilled }, [], translate)).toEqual(
      {},
    );
  });

  it('accepts zero amount when description and the other draft fields are set', () => {
    expect(
      transactionFormErrors(
        { ...draftFilled, amount: 0, description: 'x' },
        [],
        translate,
      ),
    ).toEqual({});
  });

  it('requires description on create even without a receipt file', () => {
    expect(
      transactionFormErrors(
        { ...draftFilled, description: '   ' },
        [],
        translate,
      ),
    ).toEqual({
      description: 'ra.validation.required',
    });
  });

  it('requires a vendor and receipt type when a receipt file is attached', () => {
    const file = new File(['pdf'], 'bill.pdf');
    expect(
      transactionFormErrors(
        { ...draftFilled, description: '' },
        [{ file, vendor: '', receiptTypeId: '' }],
        translate,
      ),
    ).toEqual({
      description: 'ra.validation.required',
      receipt_cards: 'app.receipt_card_required',
    });
  });
});

describe('transactionPublishFormErrors', () => {
  it('requires all seven fields before finalize', () => {
    expect(transactionPublishFormErrors(draftFilled, translate)).toEqual({
      organization: 'ra.validation.required',
      debit_account: 'ra.validation.required',
      credit_account: 'ra.validation.required',
    });
    expect(transactionPublishFormErrors(publishFilled, translate)).toEqual({});
  });
});
