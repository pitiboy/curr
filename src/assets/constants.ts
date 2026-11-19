export const ASSET_UID = 'api::asset.asset';
export const ASSET_CATEGORY_UID = 'api::asset-category.asset-category';

/** `asset.ownership_type` enum (schema.json is the source of truth; tested). */
export const ASSET_OWNERSHIP_TYPES = [
  'coop_owned',
  'member_owned_lendable',
  'barter',
] as const;

export type AssetOwnershipType = (typeof ASSET_OWNERSHIP_TYPES)[number];

export const DEFAULT_ASSET_OWNERSHIP_TYPE: AssetOwnershipType = 'coop_owned';

/** `asset.status` enum (schema.json is the source of truth; tested). */
export const ASSET_STATUSES = [
  'in_use',
  'in_storage',
  'under_repair',
  'lent_out',
  'disposed',
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const DEFAULT_ASSET_STATUS: AssetStatus = 'in_use';

/**
 * Starter categories for a small agricultural cooperative. Created by the
 * bootstrap (`ensureAssetCategories`) and by the httpyac seeder
 * (`database/seeders/http/<instance>/data/asset-categories.json`, same list).
 */
export const ASSET_CATEGORY_SEED = [
  { name: 'Mezőgazdasági gépek', sort_order: 10 },
  { name: 'Kéziszerszámok', sort_order: 20 },
  { name: 'Kerti és erdészeti gépek', sort_order: 30 },
  { name: 'Öntözés', sort_order: 40 },
  { name: 'Állattartási eszközök', sort_order: 50 },
  { name: 'Járművek', sort_order: 60 },
  { name: 'Építőanyag-tartós eszközök', sort_order: 70 },
  { name: 'Konyha és feldolgozás', sort_order: 80 },
  { name: 'Informatika és elektronika', sort_order: 90 },
  { name: 'Energetika', sort_order: 100 },
  { name: 'Bútor és tárolás', sort_order: 110 },
  { name: 'Egyéb', sort_order: 999 },
] as const;
