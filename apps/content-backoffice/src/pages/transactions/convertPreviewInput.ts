import type { InlinePreviewTransaction } from '../../data/convertPreview';
import type { ReceiptCardValue } from './ReceiptFields';

export function inlinePreviewFromCreateForm(
  formValues: Record<string, unknown>,
  receiptCards: ReceiptCardValue[],
): InlinePreviewTransaction | null {
  const date = formValues.date;
  const amountRaw = formValues.amount;
  const debit = formValues.debit_account;
  const credit = formValues.credit_account;
  const currency = formValues.currency_type;
  const transactionType = formValues.transaction_type;

  if (typeof date !== 'string' || !date.trim()) return null;
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount)) return null;
  if (typeof debit !== 'string' || !debit.trim()) return null;
  if (typeof credit !== 'string' || !credit.trim()) return null;
  if (typeof currency !== 'string' || !currency.trim()) return null;

  const receiptCount = receiptCards.filter((card) => card.file != null).length;

  return {
    date: date.trim(),
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
    receiptCount,
  };
}
