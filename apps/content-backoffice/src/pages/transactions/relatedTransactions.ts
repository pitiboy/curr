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
  // getOne records carry the numeric key as `entryId` (`id` = documentId).
  const rawEntryId = (value as { entryId?: unknown }).entryId;
  const row = value as RelatedTransactionItem;
  return {
    documentId,
    entryId:
      typeof rawId === 'number'
        ? rawId
        : typeof rawEntryId === 'number'
          ? rawEntryId
          : undefined,
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

/** The parent row is loaded whenever the record links to one. */
export function needsParentFetch(record: RaRecord): boolean {
  return parentDocumentId(record) != null;
}

function selfItem(record: RaRecord): RelatedTransactionItem | null {
  return parseRelatedTransactionItem({
    ...record,
    documentId: record.documentId ?? String(record.id),
  });
}

/**
 * Rows of the related section. A record with children shows its parent (if
 * any), itself and its children; a leaf shows its parent and the siblings
 * (itself included). The shown record is always in the list.
 */
export function relatedItemsFromRecord(
  record: RaRecord,
  parentRecord?: RaRecord | null,
): RelatedTransactionItem[] {
  const children = Array.isArray(record.related_transactions)
    ? record.related_transactions
        .map(parseRelatedTransactionItem)
        .filter((item): item is RelatedTransactionItem => item != null)
    : [];
  const self = selfItem(record);
  const parent =
    parseRelatedTransactionItem(parentRecord) ??
    parseRelatedTransactionItem(record.related_transaction);

  if (children.length > 0) {
    const merged = [
      ...(parent ? [parent] : []),
      ...(self ? [self] : []),
      ...children,
    ];
    return sortRelatedItems(dedupeByDocumentId(merged));
  }

  if (!parent) return [];
  const siblings =
    parentRecord && Array.isArray(parentRecord.related_transactions)
      ? parentRecord.related_transactions
          .map(parseRelatedTransactionItem)
          .filter((item): item is RelatedTransactionItem => item != null)
      : [];
  const merged = [parent, ...siblings, ...(self ? [self] : [])];
  return sortRelatedItems(dedupeByDocumentId(merged));
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

export type RelatedRowDeleteState =
  | 'allowed'
  /** An `expanded` row is still in the group: delete those first. */
  | 'blocked_expanded'
  /** The `original` still has a `storno` row: delete that first. */
  | 'blocked_storno';

/**
 * Controller per-row delete. Only `expanded` rows are deletable right away;
 * every other row (storno, original, not expanded) only once no `expanded`
 * row is left in the group, and the `original` also needs its storno gone.
 */
export function relatedRowDeleteState(
  item: RelatedTransactionItem,
  items: readonly RelatedTransactionItem[],
): RelatedRowDeleteState {
  if (item.converted_to_workflow === CONVERTED_EXPANDED) return 'allowed';
  const others = items.filter((row) => row.documentId !== item.documentId);
  if (others.some((row) => row.converted_to_workflow === CONVERTED_EXPANDED)) {
    return 'blocked_expanded';
  }
  if (
    item.converted_to_workflow === CONVERTED_ORIGINAL &&
    others.some((row) => row.converted_to_workflow === CONVERTED_STORNO)
  ) {
    return 'blocked_storno';
  }
  return 'allowed';
}

export type PurgeExpansionPlan = {
  /** documentId posted to `purge-expansion` (the group parent). */
  parentDocumentId: string;
  /** Parent is an `original`: storno goes too and it becomes expandable again. */
  isOriginal: boolean;
  /** Rows the purge removes (expanded + storno children of the parent). */
  rows: RelatedTransactionItem[];
};

function isExpansionRow(item: RelatedTransactionItem): boolean {
  return (
    item.converted_to_workflow === CONVERTED_EXPANDED ||
    item.converted_to_workflow === CONVERTED_STORNO
  );
}

/**
 * Group-level **Kifejtett sorok törlése**: the group parent (the shown record
 * when it has children, else its `related_transaction`) and the expanded /
 * storno children to remove. The parent need not be an `original` — e.g. a
 * bulk-entry anchor whose legs were partly expanded. Null when nothing to do.
 */
export function purgeExpansionPlan(
  items: RelatedTransactionItem[],
  record: RaRecord,
): PurgeExpansionPlan | null {
  const self = selfItem(record);
  const grandParentId = parentDocumentId(record);
  const ownChildren =
    Array.isArray(record.related_transactions) &&
    record.related_transactions.length > 0;
  const parentId = ownChildren
    ? (self?.documentId ?? null)
    : parentDocumentId(record);
  if (!parentId) return null;

  const parent =
    self?.documentId === parentId
      ? self
      : items.find((item) => item.documentId === parentId);
  const rows = items.filter(
    (item) =>
      item.documentId !== parentId &&
      // On a record with children, its own parent is listed too.
      !(ownChildren && item.documentId === grandParentId) &&
      isExpansionRow(item),
  );
  if (rows.length === 0) return null;
  return {
    parentDocumentId: parentId,
    isOriginal: parent?.converted_to_workflow === CONVERTED_ORIGINAL,
    rows,
  };
}
