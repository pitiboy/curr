import type { DataProvider } from 'ra-core';

const empty = { data: [] as never[], total: 0 };

/**
 * No-op provider so the Admin shell can render without calling Strapi.
 * Resources and real ra-strapi wiring land in later plan steps.
 */
export const emptyDataProvider: DataProvider = {
  getList: async () => empty,
  getOne: async () => {
    throw new Error('Not implemented');
  },
  getMany: async () => ({ data: [] }),
  getManyReference: async () => empty,
  create: async () => {
    throw new Error('Not implemented');
  },
  update: async () => {
    throw new Error('Not implemented');
  },
  updateMany: async () => ({ data: [] }),
  delete: async () => {
    throw new Error('Not implemented');
  },
  deleteMany: async () => ({ data: [] }),
};
