/**
 * transaction-workflow controller
 */

import { factories } from '@strapi/strapi';

import {
  convertTransactions,
  type ConvertStrapi,
} from '../../../transaction-workflow/convert-service';
import { TransactionWorkflowError } from '../../../transaction-workflow/convert';

export default factories.createCoreController(
  'api::transaction-workflow.transaction-workflow',
  ({ strapi }) => ({
    async convert(ctx) {
      const body = (ctx.request.body ?? {}) as {
        workflowDocumentId?: string;
        transactionDocumentId?: string;
        steps_published?: boolean;
      };

      try {
        const results = await convertTransactions(strapi as unknown as ConvertStrapi, {
          workflowDocumentId:
            typeof body.workflowDocumentId === 'string'
              ? body.workflowDocumentId.trim()
              : undefined,
          transactionDocumentId:
            typeof body.transactionDocumentId === 'string'
              ? body.transactionDocumentId.trim()
              : undefined,
          steps_published:
            typeof body.steps_published === 'boolean'
              ? body.steps_published
              : undefined,
        });

        ctx.body = { data: results };
      } catch (error) {
        if (error instanceof TransactionWorkflowError) {
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
    },
  }),
);
