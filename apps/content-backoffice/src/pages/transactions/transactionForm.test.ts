import { describe, expect, it } from 'vitest';

import {
  TRANSACTION_PUBLISH_REQUIRED,
  transactionFormErrors,
  transactionReviewValues,
} from './transactionForm';

const translate = (key: string) => key;

const createFilled = {
  date: '2026-10-15',
  amount: 10,
  currency_type: 'cur-1',
  description: 'papír',
};

describe('transactionFormErrors', () => {
  it('requires date, amount, currency and description on create', () => {
    expect(transactionFormErrors({ description: '' }, [], translate)).toEqual({
      date: 'ra.validation.required',
      amount: 'ra.validation.required',
      currency_type: 'ra.validation.required',
      description: 'ra.validation.required',
    });
  });

  it('saves a draft with empty organization and account fields', () => {
    expect(transactionFormErrors({ ...createFilled }, [], translate)).toEqual({});
  });

  it('accepts zero amount and rejects a blank description', () => {
    expect(
      transactionFormErrors({ ...createFilled, amount: 0, description: '   ' }, [], translate),
    ).toEqual({
      description: 'ra.validation.required',
    });
  });

  it('requires a vendor and a type when a receipt file is attached', () => {
    const file = new File(['pdf'], 'bill.pdf');
    expect(
      transactionFormErrors(
        { ...createFilled, description: '' },
        [{ file, vendor: '', receiptTypeId: '' }],
        translate,
      ),
    ).toEqual({
      description: 'ra.validation.required',
      receipt_cards: 'app.receipt_card_required',
    });
  });

  it('blocks publish when any of the seven fields is empty', () => {
    expect(
      transactionFormErrors(
        { ...createFilled },
        [],
        translate,
        TRANSACTION_PUBLISH_REQUIRED,
      ),
    ).toEqual({
      organization: 'ra.validation.required',
      debit_account: 'ra.validation.required',
      credit_account: 'ra.validation.required',
    });
  });
});

describe('transactionReviewValues', () => {
  it('keeps stored relation ids and leaves empty relations empty', () => {
    expect(
      transactionReviewValues({
        date: '2026-10-15',
        amount: 10,
        description: 'papír',
        currency_type: { documentId: 'cur-1', name: 'HUF' },
        organization: null,
        debit_account: { id: 4 },
        credit_account: { documentId: 'cre-1', code: '1000' },
      }),
    ).toEqual({
      date: '2026-10-15',
      amount: 10,
      description: 'papír',
      currency_type: 'cur-1',
      organization: '',
      debit_account: '',
      credit_account: 'cre-1',
    });
  });
});
