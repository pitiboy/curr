/** Backoffice feature flag (Settings row key) for the asset inventory menu. */
export const ASSETS_FEATURE_ID = 'assets';

/** React Admin resource names (= Strapi REST plural names). */
export const ASSETS_RESOURCE = 'assets';
export const ASSET_CATEGORIES_RESOURCE = 'asset-categories';

/** Tárgyi eszközök főkönyvi számla — holds the book value of coop-owned assets. */
export const FIXED_ASSET_ACCOUNT_CODE = '1500';

export const ASSET_OWNERSHIP_TYPES = [
  'coop_owned',
  'member_owned_lendable',
  'barter',
] as const;
export type AssetOwnershipType = (typeof ASSET_OWNERSHIP_TYPES)[number];
export const DEFAULT_ASSET_OWNERSHIP_TYPE: AssetOwnershipType = 'coop_owned';

export const ASSET_STATUSES = [
  'in_use',
  'in_storage',
  'under_repair',
  'lent_out',
  'disposed',
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export const DEFAULT_ASSET_STATUS: AssetStatus = 'in_use';

/** Choice lists for SelectInput (labels are i18n keys). */
export const ASSET_OWNERSHIP_CHOICES = ASSET_OWNERSHIP_TYPES.map((id) => ({
  id,
  name: `app.assets.ownership_types.${id}`,
}));

export const ASSET_STATUS_CHOICES = ASSET_STATUSES.map((id) => ({
  id,
  name: `app.assets.statuses.${id}`,
}));
