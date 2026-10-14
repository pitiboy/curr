import type { DataProvider, RaRecord } from 'react-admin';

type RecordWithDocumentId = RaRecord & { documentId?: string };

export function normalizeRecord<T extends RecordWithDocumentId>(record: T): T {
  if (typeof record.documentId === 'string') {
    return { ...record, id: record.documentId };
  }
  return record;
}

export function recordUsesDocumentIdAsId(record: RecordWithDocumentId): boolean {
  return (
    typeof record.documentId === 'string' && record.id === record.documentId
  );
}

function mapMany(records: RecordWithDocumentId[]) {
  return records.map((record) => normalizeRecord(record));
}

/**
 * Ensures react-admin `id` is Strapi `documentId`. With ra-strapi 1.0.3 this is
 * usually already true; the wrapper is a no-op in that case.
 */
export function withDocumentId(provider: DataProvider): DataProvider {
  return {
    ...provider,
    getList: async (resource, params) => {
      const result = await provider.getList(resource, params);
      return { ...result, data: mapMany(result.data) };
    },
    getOne: async (resource, params) => {
      const result = await provider.getOne(resource, params);
      return { data: normalizeRecord(result.data) };
    },
    getMany: async (resource, params) => {
      const result = await provider.getMany(resource, params);
      return { data: mapMany(result.data) };
    },
    getManyReference: async (resource, params) => {
      const result = await provider.getManyReference(resource, params);
      return { ...result, data: mapMany(result.data) };
    },
    create: async (resource, params) => {
      const result = await provider.create(resource, params);
      return { data: normalizeRecord(result.data) };
    },
    update: async (resource, params) => {
      const result = await provider.update(resource, params);
      return { data: normalizeRecord(result.data) };
    },
    delete: async (resource, params) => {
      const result = await provider.delete(resource, params);
      return { data: normalizeRecord(result.data) };
    },
    deleteMany: async (resource, params) =>
      provider.deleteMany!(resource, params),
    updateMany: async (resource, params) =>
      provider.updateMany!(resource, params),
  } as DataProvider;
}
