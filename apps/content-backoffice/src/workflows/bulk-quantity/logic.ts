import type { BulkQuantityHenHouse, BulkQuantityRow } from './types';

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

/** Non-zero member quantities in member list order (request `distributions`). */
export function distributionRequestRows(
  memberIds: readonly string[],
  quantities: Record<string, unknown>,
): { memberId: string; quantity: number }[] {
  const rows: { memberId: string; quantity: number }[] = [];
  for (const memberId of memberIds) {
    const quantity = parseQuantityInput(quantities[memberId]);
    if (quantity !== null) {
      rows.push({ memberId, quantity });
    }
  }
  return rows;
}
