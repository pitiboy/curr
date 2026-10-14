import { errors } from '@strapi/utils';

const TRANSACTION_UID = 'api::transaction.transaction';
const RECEIPT_UID = 'api::receipt.receipt';

const GUARDED_UIDS = new Set([TRANSACTION_UID, RECEIPT_UID]);

const PUBLISH_FORBIDDEN =
  'Only the editor role can publish transactions and receipts';

export type ContentActor = {
  roleType: string;
  email: string;
};

export type GuardEffect =
  | { type: 'ignore' }
  | { type: 'forbid' }
  | {
      type: 'allow';
      clearAuditOnData: boolean;
      enteredBy?: string;
      publishedByOnData?: string;
      draftPublishedBy?: string | null;
      publishLinkedReceipt: boolean;
    };

type DocumentParams = {
  status?: string;
  documentId?: string;
  data?: Record<string, unknown>;
  populate?: string[];
};

type DocumentsApi = {
  findOne: (params: DocumentParams) => Promise<Record<string, unknown> | null>;
  publish: (params: { documentId: string }) => Promise<unknown>;
};

type GuardContext = {
  uid: string;
  action: string;
  params?: DocumentParams;
};

type RequestState = {
  state?: {
    auth?: { strategy?: { name?: string } };
    user?: { id?: number | string };
  };
};

export type PublishGuardStrapi = {
  documents: {
    (uid: string): DocumentsApi;
    use: (
      middleware: (
        context: GuardContext,
        next: () => Promise<unknown>,
      ) => Promise<unknown>,
    ) => void;
  };
  requestContext: {
    get: () => RequestState | undefined;
  };
  db: {
    query: (uid: string) => {
      findOne: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      update: (params: {
        where: { id: number };
        data: Record<string, unknown>;
      }) => Promise<unknown>;
    };
  };
};

/**
 * Document Service middleware decision.
 * A missing status is draft at this layer. REST create/update without a
 * status query arrives here as `published`, because core-api getFetchParams
 * defaults the status before the document service runs.
 */
export function guardEffect(
  uid: string,
  action: string,
  status: string | undefined,
  actor: ContentActor | null,
): GuardEffect {
  if (!GUARDED_UIDS.has(uid)) {
    return { type: 'ignore' };
  }

  const writing = action === 'create' || action === 'update';
  const publishing =
    action === 'publish' ||
    action === 'unpublish' ||
    (writing && status === 'published');

  if (actor && actor.roleType !== 'editor' && publishing) {
    return { type: 'forbid' };
  }

  if (!actor) {
    return { type: 'ignore' };
  }

  const editorPublishing = actor.roleType === 'editor' && publishing;
  const email = actor.email.length > 0 ? actor.email : undefined;

  return {
    type: 'allow',
    clearAuditOnData: writing,
    enteredBy: action === 'create' ? email : undefined,
    publishedByOnData: editorPublishing && writing ? email : undefined,
    draftPublishedBy:
      action === 'publish' && actor.roleType === 'editor'
        ? (email ?? null)
        : action === 'unpublish' && actor.roleType === 'editor'
          ? null
          : undefined,
    publishLinkedReceipt:
      uid === TRANSACTION_UID && editorPublishing && action !== 'unpublish',
  };
}

export async function contentApiActor(
  strapi: PublishGuardStrapi,
): Promise<ContentActor | null> {
  const ctx = strapi.requestContext.get();
  if (ctx?.state?.auth?.strategy?.name !== 'users-permissions') {
    return null;
  }

  const userId = ctx.state?.user?.id;
  if (userId == null) {
    return null;
  }

  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    populate: { role: true },
  });

  const role = user?.role;
  const roleType =
    role && typeof role === 'object' && 'type' in role && typeof role.type === 'string'
      ? role.type
      : '';
  const email = typeof user?.email === 'string' ? user.email : '';

  return { roleType, email };
}

export function relationDocumentId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || !('documentId' in value)) {
    return undefined;
  }
  const documentId = value.documentId;
  return typeof documentId === 'string' && documentId.length > 0
    ? documentId
    : undefined;
}

function asData(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function documentIdOf(result: unknown): string | undefined {
  if (!result || typeof result !== 'object' || !('documentId' in result)) {
    return undefined;
  }
  const documentId = result.documentId;
  return typeof documentId === 'string' && documentId.length > 0
    ? documentId
    : undefined;
}

async function writeDraftPublishedBy(
  strapi: PublishGuardStrapi,
  uid: string,
  documentId: string,
  publishedBy: string | null,
) {
  const draft = await strapi.db.query(uid).findOne({
    where: { documentId, publishedAt: { $null: true } },
  });
  const id = draft?.id;
  if (typeof id !== 'number') {
    return;
  }

  await strapi.db.query(uid).update({
    where: { id },
    data: { published_by: publishedBy },
  });
}

async function publishLinkedReceipt(strapi: PublishGuardStrapi, documentId: string) {
  const draft = await strapi.documents(TRANSACTION_UID).findOne({
    documentId,
    status: 'draft',
    populate: ['receipt'],
  });
  const receiptId = relationDocumentId(draft?.receipt);
  if (!receiptId) {
    return;
  }

  await strapi.documents(RECEIPT_UID).publish({ documentId: receiptId });
}

export function registerPublishGuard(strapi: PublishGuardStrapi) {
  strapi.documents.use(async (context, next) => {
    const actor = await contentApiActor(strapi);
    const effect = guardEffect(
      context.uid,
      context.action,
      context.params?.status,
      actor,
    );

    if (effect.type === 'ignore') {
      return next();
    }

    if (effect.type === 'forbid') {
      throw new errors.ForbiddenError(PUBLISH_FORBIDDEN);
    }

    const params = context.params ?? {};
    context.params = params;

    if (effect.clearAuditOnData) {
      const data = asData(params.data);
      if (params.data && typeof params.data === 'object') {
        delete data.entered_by;
        delete data.published_by;
      }
    }

    if (effect.enteredBy !== undefined) {
      params.data = { ...asData(params.data), entered_by: effect.enteredBy };
    }

    if (effect.publishedByOnData !== undefined) {
      params.data = {
        ...asData(params.data),
        published_by: effect.publishedByOnData,
      };
    }

    if (
      effect.draftPublishedBy !== undefined &&
      typeof params.documentId === 'string'
    ) {
      await writeDraftPublishedBy(
        strapi,
        context.uid,
        params.documentId,
        effect.draftPublishedBy,
      );
    }

    const result = await next();

    if (effect.publishLinkedReceipt) {
      const documentId =
        typeof params.documentId === 'string'
          ? params.documentId
          : documentIdOf(result);
      if (documentId) {
        await publishLinkedReceipt(strapi, documentId);
      }
    }

    return result;
  });
}
