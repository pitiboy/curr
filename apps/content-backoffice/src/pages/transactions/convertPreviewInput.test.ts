import { describe, expect, it } from 'vitest';

import { inlinePreviewFromCreateForm } from './convertPreviewInput';

describe('inlinePreviewFromCreateForm', () => {
  it('includes hidden transaction_type when set on the form', () => {
    const preview = inlinePreviewFromCreateForm(
      {
        date: '2026-01-02',
        amount: 100,
        debit_account: 'debit-doc',
        credit_account: 'credit-doc',
        currency_type: 'cur-doc',
        transaction_type: 'type-doc',
        description: 'Test',
      },
      [],
    );
    expect(preview?.transaction_type).toEqual({ documentId: 'type-doc' });
  });

  it('omits transaction_type when the hidden field is empty', () => {
    const preview = inlinePreviewFromCreateForm(
      {
        date: '2026-01-02',
        amount: 100,
        debit_account: 'debit-doc',
        credit_account: 'credit-doc',
        currency_type: 'cur-doc',
      },
      [],
    );
    expect(preview?.transaction_type).toBeNull();
  });
});
