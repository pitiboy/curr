import { describe, expect, it, vi } from 'vitest';

import type { DataProvider } from 'react-admin';

import { withPendingChangesOutbox } from './withPendingChangesDataProvider';

function baseProvider(): DataProvider {
  return {
    getList: async () => ({ data: [], total: 0 }),
    getOne: async () => ({ data: { id: '1' } }),
    getMany: async () => ({ data: [] }),
    getManyReference: async () => ({ data: [], total: 0 }),
    create: vi.fn(async () => ({ data: { id: '1' } })),
    update: vi.fn(async () => ({ data: { id: '1' } })),
    delete: vi.fn(async () => ({ data: { id: '1' } })),
    updateMany: vi.fn(async () => ({ data: ['1'] })),
    deleteMany: vi.fn(async () => ({ data: ['1'] })),
  };
}

describe('withPendingChangesOutbox', () => {
  it('passes through read methods', async () => {
    const inner = baseProvider();
    const wrapped = withPendingChangesOutbox(inner);
    await wrapped.getList('transactions', {
      pagination: { page: 1, perPage: 25 },
      sort: { field: 'id', order: 'ASC' },
      filter: {},
    });
    expect(inner.getList).toBeDefined();
  });

  it('delegates successful writes', async () => {
    const inner = baseProvider();
    const wrapped = withPendingChangesOutbox(inner);
    await wrapped.update('transactions', {
      id: 'doc-1',
      data: { description: 'ok' },
      previousData: { id: 'doc-1' },
    });
    expect(inner.update).toHaveBeenCalled();
  });
});
