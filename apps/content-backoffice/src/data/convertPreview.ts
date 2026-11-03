import type { ContentHttpClient } from './receiptDraft';

export type PreviewAccount = {
  documentId: string;
  code: string;
  name: string | null;
};

export type PreviewCurrency = {
  documentId: string;
  code: string | null;
  name: string | null;
};

export type PreviewMovement = {
  kind: 'storno' | 'step';
  index: number | null;
  description: string;
  amount: number;
  currency: PreviewCurrency;
  debit: PreviewAccount;
  credit: PreviewAccount;
  percent: number | null;
  copyReceipt: boolean;
  organizationDocumentId: string | null;
};

export type ConvertPreview = {
  workflow: {
    documentId: string;
    name: string | null;
    keepOriginal: boolean;
    stepsPublished: boolean;
  };
  original: {
    amount: number;
    currency: PreviewCurrency;
    debit: PreviewAccount;
    credit: PreviewAccount;
    description: string;
  };
  movements: PreviewMovement[];
  warnings: string[];
};

export type InlinePreviewTransaction = {
  date: string;
  amount: number;
  description?: string | null;
  debit_account: { documentId: string };
  credit_account: { documentId: string };
  currency_type: { documentId: string };
  transaction_type?: { documentId: string } | null;
  organization?: { documentId: string } | null;
  receiptCount?: number;
};

export type ConvertPreviewRequest =
  | {
      workflowDocumentId: string;
      transactionDocumentId: string;
    }
  | {
      workflowDocumentId: string;
      transaction: InlinePreviewTransaction;
    };

type ConvertPreviewResponse = {
  data?: ConvertPreview | null;
  error?: { message?: string; status?: number };
};

export function convertPreviewUrl(strapiUrl: string): string {
  return `${strapiUrl}/api/transaction-workflows/convert-preview`;
}

export async function fetchConvertPreview(
  httpClient: ContentHttpClient,
  strapiUrl: string,
  input: ConvertPreviewRequest,
): Promise<ConvertPreview> {
  const { json } = (await httpClient(convertPreviewUrl(strapiUrl), {
    method: 'POST',
    body: JSON.stringify(input),
  })) as { json: ConvertPreviewResponse };
  if (json.data) return json.data;
  const message =
    json.error?.message ?? 'Convert preview response missing data';
  const error = new Error(message) as Error & { status?: number };
  error.status = json.error?.status;
  throw error;
}
