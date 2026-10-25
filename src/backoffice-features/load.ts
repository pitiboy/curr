import { BACKOFFICE_FEATURE_UID } from './constants';
import type { BackofficeFeatureRow } from './types';

type FeatureDocument = {
  key?: string | null;
  enabled?: boolean | null;
  config?: unknown;
};

type FeatureApi = {
  findMany: (params?: Record<string, unknown>) => Promise<FeatureDocument[]>;
};

function normalizeRow(row: FeatureDocument): BackofficeFeatureRow | null {
  const key = typeof row.key === 'string' ? row.key.trim() : '';
  if (!key) return null;
  return {
    key,
    enabled: row.enabled === true,
    config:
      row.config != null &&
      typeof row.config === 'object' &&
      !Array.isArray(row.config)
        ? (row.config as Record<string, unknown>)
        : null,
  };
}

export async function loadBackofficeFeatureRows(strapi: {
  documents: (uid: string) => FeatureApi;
}): Promise<BackofficeFeatureRow[]> {
  try {
    const rows = await strapi.documents(BACKOFFICE_FEATURE_UID).findMany({
      sort: { key: 'asc' },
    });
    return rows
      .map(normalizeRow)
      .filter((row): row is BackofficeFeatureRow => row != null);
  } catch {
    return [];
  }
}
