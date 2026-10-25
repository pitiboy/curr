import { loadBackofficeFeatureRows } from './load';
import { publishPolicyFromFeatures } from './parse';
import { DEFAULT_PUBLISH_POLICY, type PublishPolicy } from '../publish-guard';

export function createPublishPolicyLoader(strapi: {
  documents: (uid: string) => {
    findMany: (params?: Record<string, unknown>) => Promise<unknown[]>;
  };
}): () => Promise<PublishPolicy> {
  return async () => {
    try {
      const rows = await loadBackofficeFeatureRows(strapi);
      if (rows.length === 0) {
        return DEFAULT_PUBLISH_POLICY;
      }
      return publishPolicyFromFeatures(rows);
    } catch {
      return DEFAULT_PUBLISH_POLICY;
    }
  };
}
