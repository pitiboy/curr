import type {
  BulkQuantityConflictChoice,
  BulkQuantityDuplicate,
  BulkQuantityHenHouse,
  BulkQuantityResolvedRefs,
  BulkQuantityRow,
  BulkQuantityRowPlan,
  BulkQuantityRowResult,
} from './types';

export function todayIsoDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function parseQuantityInput(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const numeric =
    typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(numeric) || numeric < 0 || !Number.isInteger(numeric)) {
    return null;
  }
  if (numeric === 0) {
    return null;
  }
  return numeric;
}

export function invalidQuantityInput(value: unknown): boolean {
  if (value === '' || value === null || value === undefined) {
    return false;
  }
  const numeric =
    typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(numeric) || numeric < 0 || !Number.isInteger(numeric)) {
    return true;
  }
  return false;
}

export function rowsFromQuantities(
  henHouses: readonly BulkQuantityHenHouse[],
  quantities: Record<string, unknown>,
): BulkQuantityRow[] {
  const rows: BulkQuantityRow[] = [];
  for (const house of henHouses) {
    const amount = parseQuantityInput(quantities[house.documentId]);
    if (amount === null) {
      continue;
    }
    rows.push({
      organizationId: house.documentId,
      organizationName: house.name,
      amount,
    });
  }
  return rows;
}

export function duplicateQueryFilters(input: {
  date: string;
  organizationId: string;
  currencyTypeId: string;
  debitAccountId: string;
  creditAccountId: string;
}): Record<string, unknown> {
  return {
    date: { $eq: input.date },
    organization: { documentId: { $eq: input.organizationId } },
    currency_type: { documentId: { $eq: input.currencyTypeId } },
    debit_account: { documentId: { $eq: input.debitAccountId } },
    credit_account: { documentId: { $eq: input.creditAccountId } },
  };
}

export type DuplicateCandidate = {
  documentId: string;
  amount: number;
};

export function pickDuplicateCandidate(
  matches: readonly DuplicateCandidate[],
): DuplicateCandidate | null {
  if (matches.length === 0) {
    return null;
  }
  return matches[0] ?? null;
}

export function mergeDuplicateMatches<
  T extends { documentId?: string; amount?: string | number | null },
>(drafts: readonly T[], published: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of drafts) {
    if (row.documentId) {
      byId.set(row.documentId, row);
    }
  }
  for (const row of published) {
    if (row.documentId) {
      byId.set(row.documentId, row);
    }
  }
  return [...byId.values()];
}

export function toDuplicateCandidate(row: {
  documentId?: string;
  amount?: string | number | null;
}): DuplicateCandidate | null {
  if (!row.documentId) {
    return null;
  }
  const amount = Number(row.amount);
  if (!Number.isFinite(amount)) {
    return null;
  }
  return { documentId: row.documentId, amount };
}

export function buildTransactionPayload(
  refs: BulkQuantityResolvedRefs,
  row: BulkQuantityRow,
  date: string,
  description: string,
): Record<string, unknown> {
  return {
    date,
    amount: row.amount,
    description,
    organization: row.organizationId,
    debit_account: refs.debitAccountId,
    credit_account: refs.creditAccountId,
    currency_type: refs.currencyTypeId,
    transaction_type: refs.transactionTypeId,
  };
}

export function buildRowPlans(
  rows: readonly BulkQuantityRow[],
  duplicates: readonly BulkQuantityDuplicate[],
  choices: Readonly<Record<string, BulkQuantityConflictChoice>>,
): BulkQuantityRowPlan[] {
  const duplicateByOrg = new Map(
    duplicates.map((item) => [item.row.organizationId, item]),
  );
  return rows.map((row) => {
    const duplicate = duplicateByOrg.get(row.organizationId);
    if (!duplicate) {
      return { ...row, action: 'insert' as const };
    }
    const choice = choices[row.organizationId] ?? 'update';
    return {
      ...row,
      action: choice,
      updateDocumentId:
        choice === 'update' ? duplicate.existingDocumentId : undefined,
    };
  });
}

export function mergeRowResults(
  previous: readonly BulkQuantityRowResult[],
  next: readonly BulkQuantityRowResult[],
): BulkQuantityRowResult[] {
  const byOrg = new Map(previous.map((row) => [row.organizationId, row]));
  for (const row of next) {
    byOrg.set(row.organizationId, row);
  }
  return [...byOrg.values()];
}

export function failedRowIds(results: readonly BulkQuantityRowResult[]): string[] {
  return results
    .filter((row) => row.status === 'error')
    .map((row) => row.organizationId);
}

export function plansForRetry(
  plans: readonly BulkQuantityRowPlan[],
  failedIds: readonly string[],
): BulkQuantityRowPlan[] {
  const failed = new Set(failedIds);
  return plans.filter((plan) => failed.has(plan.organizationId));
}
