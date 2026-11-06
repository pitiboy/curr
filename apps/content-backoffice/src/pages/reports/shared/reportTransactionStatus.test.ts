import { describe, expect, it } from 'vitest';

import type { ReportTransactionStatusFilter } from './reportTransactionStatus';
import {
  mergeReportTransactionsByDocumentId,
  transactionStatusQuery,
} from './reportTransactionStatus';

describe('transactionStatusQuery', () => {
  it.each<
    [
      ReportTransactionStatusFilter,
      ReturnType<typeof transactionStatusQuery>,
    ]
  >([
    ['draft', { status: 'draft', publicationFilter: 'never-published' }],
    ['preview', { status: 'published' }],
    ['all', {}],
  ])('maps %s to API shape', (mode, expected) => {
    expect(transactionStatusQuery(mode)).toEqual(expected);
  });
});

describe('mergeReportTransactionsByDocumentId', () => {
  it('prefers published over draft for the same documentId', () => {
    const merged = mergeReportTransactionsByDocumentId(
      [{ documentId: 'a', amount: 1 }],
      [{ documentId: 'a', amount: 2 }],
    );
    expect(merged).toEqual([{ documentId: 'a', amount: 2 }]);
  });

  it('keeps draft-only rows', () => {
    const merged = mergeReportTransactionsByDocumentId(
      [{ documentId: 'b', amount: 3 }],
      [],
    );
    expect(merged).toEqual([{ documentId: 'b', amount: 3 }]);
  });

  it('keeps published-only rows', () => {
    const merged = mergeReportTransactionsByDocumentId(
      [],
      [{ documentId: 'c', amount: 4 }],
    );
    expect(merged).toEqual([{ documentId: 'c', amount: 4 }]);
  });
});
