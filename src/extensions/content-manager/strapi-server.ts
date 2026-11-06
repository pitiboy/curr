import { patchDocumentManagerBulkActions } from '../../content-manager-bulk-publish';
import {
  sanitizeConfigurationLayouts,
  type ConfigurationBody,
  type LayoutSchema,
} from '../../content-manager-config-sanitize';

type CmContext = {
  params: { uid: string };
  request: { body: ConfigurationBody };
};

type CmController = (ctx: CmContext) => Promise<unknown>;

type DocumentManagerFactory = (params: {
  strapi: unknown;
}) => Record<string, unknown>;

type ContentManagerPlugin = {
  controllers: {
    'content-types': {
      updateContentTypeConfiguration: CmController;
    };
    components: {
      updateComponentConfiguration: CmController;
    };
  };
  services: {
    'document-manager': DocumentManagerFactory;
  };
};

type StrapiLike = {
  getModel: (uid: string) => LayoutSchema | undefined;
  log: {
    debug: (message: string) => void;
  };
};

function getStrapi(): StrapiLike {
  return (globalThis as { strapi: StrapiLike }).strapi;
}

function sanitizeBodyForUid(
  uid: string,
  body: ConfigurationBody,
): ConfigurationBody {
  const schema = getStrapi().getModel(uid);
  if (!schema?.attributes) {
    return body;
  }

  const { body: sanitized, stripped } = sanitizeConfigurationLayouts(
    body,
    schema,
  );

  if (stripped.length > 0) {
    getStrapi().log.debug(
      `content-manager configuration: stripped non-editable layout fields for ${uid}: ${stripped.join(', ')}`,
    );
  }

  return sanitized;
}

function withSanitizedLayouts(original: CmController): CmController {
  return async (ctx) => {
    const { uid } = ctx.params;
    if (uid && ctx.request?.body) {
      ctx.request.body = sanitizeBodyForUid(uid, ctx.request.body);
    }
    return original(ctx);
  };
}

/**
 * Admin Configure the view can PUT layouts.edit that still include system
 * fields (createdAt/…) or removed attributes. CM yup rejects those names.
 * Strip them before the stock validators run.
 *
 * Also: Admin bulkPublish / bulkUnpublish / bulkDelete must not Promise.all
 * inside one knex transaction (one failure → sibling queries on a rolled-back
 * trx → process crash). See content-manager-bulk-publish.ts.
 */
module.exports = (plugin: ContentManagerPlugin) => {
  plugin.controllers['content-types'].updateContentTypeConfiguration =
    withSanitizedLayouts(
      plugin.controllers['content-types'].updateContentTypeConfiguration,
    );

  plugin.controllers.components.updateComponentConfiguration =
    withSanitizedLayouts(
      plugin.controllers.components.updateComponentConfiguration,
    );

  const createDocumentManager = plugin.services['document-manager'];
  plugin.services['document-manager'] = ({ strapi }) =>
    patchDocumentManagerBulkActions(
      createDocumentManager({ strapi }) as never,
      strapi as never,
    ) as unknown as Record<string, unknown>;

  return plugin;
};
