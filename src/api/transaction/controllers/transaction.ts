/**
 * transaction controller
 */

import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

import { loadBackofficeFeatureRows } from '../../../backoffice-features/load';
import { withPublishGuardLinked } from '../../../publish-guard';
import {
  discardDraftTransaction,
  DiscardDraftError,
  type DiscardDraftStrapi,
} from '../../../transaction-discard/discard-service';
import {
  handlePurgeExpansion,
  handleTransactionDelete,
} from '../../../transaction-delete/delete-handlers';
import { type TransactionDeleteStrapi } from '../../../transaction-delete/delete-service';

export default factories.createCoreController(
  'api::transaction.transaction',
  ({ strapi }) => ({
    /**
     * Content API users (controller role) go through the guarded delete with
     * receipt cascade. API tokens (seeders, reset scripts) keep the core delete.
     */
    async delete(ctx) {
      return handleTransactionDelete(
        strapi as unknown as TransactionDeleteStrapi,
        ctx,
        () => super.delete(ctx),
      );
    },
    async purgeExpansion(ctx) {
      await handlePurgeExpansion(
        strapi as unknown as TransactionDeleteStrapi,
        ctx,
      );
    },
    async discardDraft(ctx) {
      const rawId = ctx.params?.id;
      const documentId = typeof rawId === 'string' ? rawId.trim() : '';
      try {
        await discardDraftTransaction(
          strapi as unknown as DiscardDraftStrapi,
          documentId,
        );
      } catch (error) {
        if (error instanceof DiscardDraftError) {
          ctx.status = error.status;
          ctx.body = {
            data: null,
            error: {
              status: error.status,
              name: error.name,
              message: error.message,
            },
          };
          return;
        }
        throw error;
      }
      ctx.body = { data: { documentId } };
    },
    async publish(ctx) {
      const rawId = ctx.params?.id;
      const documentId = typeof rawId === 'string' ? rawId.trim() : '';
      if (!documentId) {
        ctx.badRequest('Missing document id');
        return;
      }
      const wantsEggAuto =
        ctx.query?.eggAuto === '1' || ctx.query?.eggAuto === 'true';
      let eggAutoFinalize = false;
      if (wantsEggAuto) {
        const rows = await loadBackofficeFeatureRows(
          strapi as Parameters<typeof loadBackofficeFeatureRows>[0],
        );
        const egg = rows.find((r) => r.key === 'egg-production');
        const raw = egg?.config?.initialPublicationStatus;
        eggAutoFinalize =
          typeof raw === 'string' && raw.trim().toLowerCase() === 'published';
      }
      try {
        const runPublish = () =>
          strapi.documents('api::transaction.transaction').publish({
            documentId,
          });
        if (eggAutoFinalize) {
          await withPublishGuardLinked(strapi, runPublish, {
            eggWorkflowAuto: true,
          });
        } else {
          await runPublish();
        }
      } catch (error) {
        // Route auth turns a thrown ForbiddenError into a generic 403 and
        // drops the guard message. Write the response here so the client
        // can tell a same-person rejection from any other failure.
        if (error instanceof errors.ForbiddenError) {
          ctx.status = 403;
          ctx.body = {
            data: null,
            error: {
              status: 403,
              name: error.name,
              message: error.message,
              details: error.details,
            },
          };
          return;
        }
        throw error;
      }
      ctx.body = { data: { documentId } };
    },
  }),
);
