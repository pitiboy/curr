import type { DataProvider } from 'react-admin';

/** Placeholder until Strapi is wired in step 3; no HTTP calls. */
export const noopDataProvider: DataProvider = {
  getList: async () => ({ data: [], total: 0 }),
  getOne: async () => {
    throw new Error('Not implemented');
  },
  getMany: async () => ({ data: [] }),
  getManyReference: async () => ({ data: [], total: 0 }),
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
