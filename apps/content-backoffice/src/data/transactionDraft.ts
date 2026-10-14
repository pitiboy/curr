type DraftHttpClient = (
  url: string,
  options?: { method?: string; body?: string },
) => Promise<{ json: { data?: Record<string, unknown> } }>;

/** REST create without this query publishes, and dataentry publish is 403. */
export function transactionDraftUrl(strapiUrl: string): string {
  return `${strapiUrl}/api/transactions?status=draft`;
}

/**
 * Whitelist of the create form. Audit fields and the workflow relations
 * stay off the payload even if they arrive in the form data.
 */
export function transactionDraftBody(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  const date = asDate(input.date);
  if (date) body.date = date;
  if (isAmount(input.amount)) body.amount = input.amount;

  if (typeof input.description === 'string' && input.description.trim()) {
    body.description = input.description.trim();
  }

  for (const key of [
    'organization',
    'debit_account',
    'credit_account',
    'currency_type',
  ] as const) {
    const value = relationId(input[key]);
    if (value) body[key] = value;
  }

  return body;
}

export async function createTransactionDraft(
  httpClient: DraftHttpClient,
  strapiUrl: string,
  data: Record<string, unknown>,
) {
  const { json } = await httpClient(transactionDraftUrl(strapiUrl), {
    method: 'POST',
    body: JSON.stringify({ data: transactionDraftBody(data) }),
  });
  const created = json.data ?? {};
  const documentId =
    typeof created.documentId === 'string' ? created.documentId : '';
  return {
    data: {
      ...created,
      id: documentId,
      documentId,
    },
  };
}

function asDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : undefined;
}

function isAmount(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim() !== '';
  return false;
}

function relationId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}
