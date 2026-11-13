import { contentApiActor, type PublishGuardStrapi } from '../publish-guard';
import { CONTROLLER_ROLE } from '../transaction-delete/delete-service';
import { ReconciliationError } from './errors';

export async function assertReconciliationController(
  strapi: Pick<PublishGuardStrapi, 'requestContext'>,
): Promise<void> {
  const actor = await contentApiActor(strapi as PublishGuardStrapi);
  if (!actor) {
    throw new ReconciliationError('Forbidden', 403);
  }
  if (actor.roleType !== CONTROLLER_ROLE) {
    throw new ReconciliationError(
      'Only the controller role can view the reconciliation report',
      403,
    );
  }
}
