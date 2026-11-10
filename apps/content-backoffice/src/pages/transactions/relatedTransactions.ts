import type { RaRecord } from 'react-admin';

import {
  CONVERTED_EXPANDED,
  CONVERTED_ORIGINAL,
  CONVERTED_STORNO,
  isExpandableConvertedValue,
  type ConvertedToWorkflow,
} from '../../data/transactionList';

export type RelatedTransactionItem = {
  documentId: string;
  /** Strapi numeric primary key (list „ID” column). */
  entryId?: number;
  date?: string | null;
  amount?: string | number | null;
  description?: string | null;
  converted_to_workflow?: ConvertedToWorkflow | boolean | null;
  currency_type?: { code?: string | null; name?: string | null } | null;
  debit_account?: {
    code?: string | null;
    name?: string | null;
  } | null;
  credit_account?: {
    code?: string | null;
    name?: string | null;
  } | null;
};

export function parseRelatedTransactionItem(
  value: unknown,
): RelatedTransactionItem | null {
  if (!value || typeof value !== 'object') return null;
  const documentId = (value as { documentId?: string }).documentId;
  if (!documentId) return null;
  const rawId = (value as { id?: unknown }).id;
  const row = value as RelatedTransactionItem;
  return {
    documentId,
    entryId: typeof rawId === 'number' ? rawId : undefined,
    date: row.date,
    amount: row.amount,
    description: row.description,
    converted_to_workflow: row.converted_to_workflow,
    currency_type: row.currency_type,
    debit_account: row.debit_account,
    credit_account: row.credit_account,
  };
}

export function hasRelatedTransactionLink(record: RaRecord): boolean {
  const children = record.related_transactions;
  if (Array.isArray(children) && children.length > 0) return true;
  return parentDocumentId(record) != null;
}

export function relatedTransactionCountHint(record: RaRecord): number | null {
  const children = record.related_transactions;
  if (Array.isArray(children) && children.length > 0) return children.length;
  return null;
}

export function parentDocumentId(record: RaRecord): string | null {
  const parent = record.related_transaction;
  if (!parent || typeof parent !== 'object') return null;
  const id = (parent as { documentId?: string }).documentId;
  return id ?? null;
}

export function needsParentFetch(record: RaRecord): boolean {
  const children = record.related_transactions;
  const hasChildren = Array.isArray(children) && children.length > 0;
  if (hasChildren) return false;
  return parentDocumentId(record) != null;
}

export function relatedItemsFromRecord(
  record: RaRecord,
  parentRecord?: RaRecord | null,
): RelatedTransactionItem[] {
  const children = Array.isArray(record.related_transactions)
    ? record.related_transactions
        .map(parseRelatedTransactionItem)
        .filter((item): item is RelatedTransactionItem => item != null)
    : [];

  if (children.length > 0) {
    return sortRelatedItems(children);
  }

  if (parentRecord) {
    const parent = parseRelatedTransactionItem(parentRecord);
    const siblings = Array.isArray(parentRecord.related_transactions)
      ? parentRecord.related_transactions
          .map(parseRelatedTransactionItem)
          .filter((item): item is RelatedTransactionItem => item != null)
      : [];
    const merged = parent ? [parent, ...siblings] : siblings;
    return sortRelatedItems(dedupeByDocumentId(merged));
  }

  const parentOnly = parseRelatedTransactionItem(record.related_transaction);
  return parentOnly ? [parentOnly] : [];
}

function dedupeByDocumentId(
  items: RelatedTransactionItem[],
): RelatedTransactionItem[] {
  const seen = new Set<string>();
  const out: RelatedTransactionItem[] = [];
  for (const item of items) {
    if (seen.has(item.documentId)) continue;
    seen.add(item.documentId);
    out.push(item);
  }
  return out;
}

function sortRelatedItems(
  items: RelatedTransactionItem[],
): RelatedTransactionItem[] {
  return [...items].sort((a, b) => {
    const aId = a.entryId;
    const bId = b.entryId;
    if (aId != null && bId != null && aId !== bId) return aId - bId;
    if (aId != null && bId == null) return -1;
    if (aId == null && bId != null) return 1;
    return a.documentId.localeCompare(b.documentId);
  });
}

const convertedI18nKey: Record<string, string> = {
  [CONVERTED_EXPANDED]: 'app.converted.expanded',
  [CONVERTED_STORNO]: 'app.converted.storno',
  [CONVERTED_ORIGINAL]: 'app.converted.original',
};

export function convertedLabelKey(
  value: RelatedTransactionItem['converted_to_workflow'],
): string | null {
  if (isExpandableConvertedValue(value)) return null;
  if (typeof value === 'string' && value in convertedI18nKey) {
    return convertedI18nKey[value];
  }
  return null;
}

/** Controller per-row delete: only `expanded` rows (storno via purge). */
export function canDeleteRelatedRow(item: RelatedTransactionItem): boolean {
  return item.converted_to_workflow === CONVERTED_EXPANDED;
}

/**
 * `original` documentId for **Kifejtés törlése** when the group still has
 * expanded or storno rows; otherwise null. On the original's Show the items
 * are only its children, so the shown record is checked as well.
 */
export function purgeExpansionTarget(
  items: RelatedTransactionItem[],
  record?: RaRecord | null,
): string | null {
  const self = record
    ? parseRelatedTransactionItem({
        ...record,
        documentId: record.documentId ?? String(record.id),
      })
    : null;
  const original = [...(self ? [self] : []), ...items].find(
    (item) => item.converted_to_workflow === CONVERTED_ORIGINAL,
  );
  if (!original) return null;
  const hasExpansion = items.some(
    (item) =>
      item.converted_to_workflow === CONVERTED_EXPANDED ||
      item.converted_to_workflow === CONVERTED_STORNO,
  );
  return hasExpansion ? original.documentId : null;
}

/** documentIds removed by a purge of `items` (expanded + storno rows). */
export function expansionDocumentIds(
  items: RelatedTransactionItem[],
): string[] {
  return items
    .filter(
      (item) =>
        item.converted_to_workflow === CONVERTED_EXPANDED ||
        item.converted_to_workflow === CONVERTED_STORNO,
    )
    .map((item) => item.documentId);
}
