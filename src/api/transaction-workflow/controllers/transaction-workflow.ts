/**
 * transaction-workflow controller
 */

import { factories } from '@strapi/strapi';

import { EDITOR_LIKE_ROLE_TYPES } from '../../../content-roles';
import {
  convertTransactions,
  parseOverridesPayload,
  type ConvertStrapi,
} from '../../../transaction-workflow/convert-service';
import { ERROR_CONVERT_OVERRIDES_FORBIDDEN } from '../../../transaction-workflow/convert-overrides';
import {
  convertPreview,
  type ConvertPreviewRequest,
  type PreviewStrapi,
} from '../../../transaction-workflow/preview-service';
import { TransactionWorkflowError } from '../../../transaction-workflow/convert';

/** Strapi-style error; `details.code` carries the machine code (e.g. CURRENCY_RATE_MISSING). */
function errorBody(error: TransactionWorkflowError) {
  return {
    status: error.status,
    name: error.name,
    message: error.message,
    ...(error.code || error.details
      ? { details: { ...(error.details ?? {}), code: error.code } }
      : {}),
  };
}

export default factories.createCoreController(
  'api::transaction-workflow.transaction-workflow',
  ({ strapi }) => ({
    async convert(ctx) {
      const body = (ctx.request.body ?? {}) as {
        workflowDocumentId?: string;
        transactionDocumentId?: string;
        steps_published?: boolean;
        overrides?: unknown;
      };

      const overrides = parseOverridesPayload(body.overrides);
      if (overrides) {
        const roleType = (ctx.state as { user?: { role?: { type?: string } } })
          .user?.role?.type;
        if (
          !roleType ||
          !(EDITOR_LIKE_ROLE_TYPES as readonly string[]).includes(roleType)
        ) {
          ctx.status = 403;
          ctx.body = {
            data: null,
            error: errorBody(
              new TransactionWorkflowError(
                'Customised convert is only available to editor roles',
                403,
                ERROR_CONVERT_OVERRIDES_FORBIDDEN,
              ),
            ),
          };
          return;
        }
      }

      try {
        const { results, failures } = await convertTransactions(
          strapi as unknown as ConvertStrapi,
          {
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
            overrides,
          },
        );

        ctx.body = {
          data: results,
          ...(failures.length > 0 ? { failures } : {}),
        };
      } catch (error) {
        if (error instanceof TransactionWorkflowError) {
          ctx.status = error.status;
          ctx.body = {
            data: null,
            error: errorBody(error),
          };
          return;
        }
        throw error;
      }
    },
    async convertPreview(ctx) {
      const body = (ctx.request.body ?? {}) as ConvertPreviewRequest & {
        transaction?: unknown;
      };

      try {
        const preview = await convertPreview(
          strapi as unknown as PreviewStrapi,
          {
            workflowDocumentId:
              typeof body.workflowDocumentId === 'string'
                ? body.workflowDocumentId.trim()
                : undefined,
            transactionDocumentId:
              typeof body.transactionDocumentId === 'string'
                ? body.transactionDocumentId.trim()
                : undefined,
            transaction:
              body.transaction as ConvertPreviewRequest['transaction'],
          },
        );

        ctx.body = { data: preview };
      } catch (error) {
        if (error instanceof TransactionWorkflowError) {
          ctx.status = error.status;
          ctx.body = {
            data: null,
            error: errorBody(error),
          };
          return;
        }
        throw error;
      }
    },
  }),
);
