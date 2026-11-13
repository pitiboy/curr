import { loadBackofficeFeatureRows } from '../backoffice-features/load';
import { rolesFromFeatureConfig } from '../backoffice-features/parse';
import { contentApiActor, type PublishGuardStrapi } from '../publish-guard';
import { CONTROLLER_ROLE } from '../transaction-delete/delete-service';
import { ReconciliationError } from './errors';

const RECONCILIATION_FEATURE_KEY = 'reconciliation';
const DEFAULT_RECONCILIATION_ROLES = [CONTROLLER_ROLE] as const;

type FeatureDocumentsStrapi = {
  documents: (uid: string) => {
    findMany: (params?: Record<string, unknown>) => Promise<unknown[]>;
  };
};

/** Editor in the allow-list also admits controller (same as SPA `roleAllowed`). */
function roleAllowed(allowed: readonly string[], role: string): boolean {
  if (allowed.includes(role)) return true;
  return role === CONTROLLER_ROLE && allowed.includes('editor');
}

export async function reconciliationAllowedRoles(
  strapi: FeatureDocumentsStrapi,
): Promise<readonly string[]> {
  const rows = await loadBackofficeFeatureRows(strapi);
  const feature = rows.find((row) => row.key === RECONCILIATION_FEATURE_KEY);
  const fromConfig = rolesFromFeatureConfig(feature?.config);
  return fromConfig.length > 0 ? fromConfig : DEFAULT_RECONCILIATION_ROLES;
}

export async function assertReconciliationController(
  strapi: Pick<PublishGuardStrapi, 'requestContext'> &
    Partial<FeatureDocumentsStrapi>,
): Promise<void> {
  const actor = await contentApiActor(strapi as PublishGuardStrapi);
  if (!actor) {
    throw new ReconciliationError('Forbidden', 403);
  }
  const allowed =
    typeof strapi.documents === 'function'
      ? await reconciliationAllowedRoles(strapi as FeatureDocumentsStrapi)
      : DEFAULT_RECONCILIATION_ROLES;
  if (!roleAllowed(allowed, actor.roleType)) {
    throw new ReconciliationError(
      'Only configured roles can view the reconciliation report',
      403,
    );
  }
}
