import { ASSET_CATEGORY_SEED, ASSET_CATEGORY_UID } from './constants';

type AssetCategoryRow = { name?: string | null };

type AssetCategoryApi = {
  findMany: (params?: Record<string, unknown>) => Promise<AssetCategoryRow[]>;
  create: (params: {
    data: { name: string; sort_order?: number };
  }) => Promise<unknown>;
};

function normalizeName(name: string | null | undefined): string {
  return (name ?? '').trim().toLocaleLowerCase('hu');
}

/**
 * Idempotent: creates only the starter categories whose name (trimmed,
 * case-insensitive) is not stored yet. Existing rows — including renamed or
 * reordered ones — are never touched.
 */
export async function ensureAssetCategories(strapi: {
  documents: (uid: string) => AssetCategoryApi;
  log: { info: (message: string) => void };
}): Promise<string[]> {
  const api = strapi.documents(ASSET_CATEGORY_UID);
  const existing = await api.findMany({ fields: ['name'], limit: 1000 });
  const names = new Set(
    existing.map((row) => normalizeName(row.name)).filter(Boolean),
  );

  const created: string[] = [];
  for (const item of ASSET_CATEGORY_SEED) {
    const key = normalizeName(item.name);
    if (names.has(key)) continue;
    await api.create({
      data: { name: item.name, sort_order: item.sort_order },
    });
    names.add(key);
    created.push(item.name);
    strapi.log.info(`Created asset category "${item.name}"`);
  }
  return created;
}
