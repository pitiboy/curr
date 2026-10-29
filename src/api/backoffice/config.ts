import { loadBackofficeFeatureRows } from '../../backoffice-features/load';
import {
  buildBackofficeConfigFromFeatures,
  emptyBackofficeConfig,
} from '../../backoffice-features/parse';
import type { BackofficeConfigResponse } from '../../backoffice-features/types';

export type { BackofficeConfigResponse };

export async function loadBackofficeConfig(strapi: {
  documents: (uid: string) => {
    findMany: (params?: Record<string, unknown>) => Promise<unknown[]>;
  };
}): Promise<BackofficeConfigResponse> {
  const rows = await loadBackofficeFeatureRows(strapi);
  if (rows.length === 0) {
    return emptyBackofficeConfig();
  }
  return buildBackofficeConfigFromFeatures(rows);
}

/** @deprecated Use {@link loadBackofficeConfig}. Sync helper for unit tests. */
export function buildBackofficeConfigFromRows(
  rows: Parameters<typeof buildBackofficeConfigFromFeatures>[0],
): BackofficeConfigResponse {
  return buildBackofficeConfigFromFeatures(rows);
}
