import type { InlinePreviewTransaction } from '../../data/convertPreview';
import type { ReceiptCardValue } from './ReceiptFields';

/** React Admin DateInput may store ISO strings or Date instances. */
export function normalizeCreateFormDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
}

export function normalizeCreateFormAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function inlinePreviewFromCreateForm(
  formValues: Record<string, unknown>,
  receiptCards: ReceiptCardValue[],
): InlinePreviewTransaction | null {
  const date = normalizeCreateFormDate(formValues.date);
  const amount = normalizeCreateFormAmount(formValues.amount);
  const debit = formValues.debit_account;
  const credit = formValues.credit_account;
  const currency = formValues.currency_type;
  const transactionType = formValues.transaction_type;
  const organization = formValues.organization;

  if (!date || amount == null) return null;
  if (typeof debit !== 'string' || !debit.trim()) return null;
  if (typeof credit !== 'string' || !credit.trim()) return null;
  if (typeof currency !== 'string' || !currency.trim()) return null;

  const receiptCount = receiptCards.filter((card) => card.file != null).length;

  return {
    date,
    amount,
    description:
      typeof formValues.description === 'string'
        ? formValues.description
        : null,
    debit_account: { documentId: debit.trim() },
    credit_account: { documentId: credit.trim() },
    currency_type: { documentId: currency.trim() },
    transaction_type:
      typeof transactionType === 'string' && transactionType.trim()
        ? { documentId: transactionType.trim() }
        : null,
    organization:
      typeof organization === 'string' && organization.trim()
        ? { documentId: organization.trim() }
        : null,
    receiptCount,
  };
}
