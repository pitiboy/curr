import { describe, expect, it } from 'vitest';

import type { DataProvider } from 'react-admin';

import {
  normalizeRecord,
  recordUsesDocumentIdAsId,
  withDocumentId,
} from './withDocumentId';

describe('normalizeRecord', () => {
  it('maps id to documentId when documentId is present', () => {
    const record = normalizeRecord({
      id: 42,
      documentId: 'doc-abc',
    });
    expect(record.id).toBe('doc-abc');
  });

  it('is a no-op when id already equals documentId (ra-strapi 1.0.3)', () => {
    const input = { id: 'doc-abc', documentId: 'doc-abc', ref: 7 };
    const record = normalizeRecord(input);
    expect(recordUsesDocumentIdAsId(record)).toBe(true);
    expect(record).toEqual(input);
  });
});

describe('withDocumentId', () => {
  it('passes through getOne when id is already documentId', async () => {
    const inner = {
      getList: async () => ({ data: [], total: 0 }),
      getOne: async () => ({
        data: { id: 'doc-1', documentId: 'doc-1' },
      }),
      getMany: async () => ({ data: [] }),
      getManyReference: async () => ({ data: [], total: 0 }),
      create: async () => ({ data: { id: 'doc-1', documentId: 'doc-1' } }),
      update: async () => ({ data: { id: 'doc-1', documentId: 'doc-1' } }),
      delete: async () => ({ data: { id: 'doc-1', documentId: 'doc-1' } }),
    } satisfies DataProvider;

    const wrapped = withDocumentId(inner);
    const { data } = await wrapped.getOne('transactions', { id: 'doc-1' });
    expect(data.id).toBe('doc-1');
    expect(recordUsesDocumentIdAsId(data)).toBe(true);
  });
});
