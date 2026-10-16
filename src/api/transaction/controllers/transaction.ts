/**
 * transaction controller
 */

import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

export default factories.createCoreController(
  'api::transaction.transaction',
  ({ strapi }) => ({
    async publish(ctx) {
      const rawId = ctx.params?.id;
      const documentId = typeof rawId === 'string' ? rawId.trim() : '';
      if (!documentId) {
        ctx.badRequest('Missing document id');
        return;
      }
      try {
        await strapi.documents('api::transaction.transaction').publish({
          documentId,
        });
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
