import { errors } from '@strapi/utils';

const TRANSACTION_UID = 'api::transaction.transaction';
const RECEIPT_UID = 'api::receipt.receipt';

const GUARDED_UIDS = new Set([TRANSACTION_UID, RECEIPT_UID]);

const PUBLISH_FORBIDDEN =
  'Only the editor role can publish transactions and receipts';
const DRAFT_ONLY =
  'Transactions and receipts are saved as drafts; publishing on create or update is disabled';
const SAME_PERSON = 'The person who entered the document cannot publish it';

/** Draft HTTP writes: Strapi skips schema `required`, middleware enforces these four. */
export const TRANSACTION_DRAFT_REQUIRED_FIELDS = [
  'date',
  'amount',
  'currency_type',
  'description',
] as const;

/** Publish reads the stored draft; all seven must be filled. */
export const TRANSACTION_PUBLISH_REQUIRED_FIELDS = [
  'date',
  'amount',
  'currency_type',
  'description',
  'organization',
  'debit_account',
  'credit_account',
] as const;

/** @deprecated Use {@link TRANSACTION_DRAFT_REQUIRED_FIELDS}. */
export const TRANSACTION_REQUIRED_FIELDS = TRANSACTION_DRAFT_REQUIRED_FIELDS;

export type TransactionDraftRequiredField =
  (typeof TRANSACTION_DRAFT_REQUIRED_FIELDS)[number];

export type TransactionPublishRequiredField =
  (typeof TRANSACTION_PUBLISH_REQUIRED_FIELDS)[number];

export type TransactionRequiredField = TransactionDraftRequiredField;

export type PublishPolicy = {
  /** `draft`: create/update cannot publish. `published`: an editor may save as published. */
  defaultStatus: 'draft' | 'published';
  /** When true, entered_by and the publisher must be different people. */
  publisherMustDiffer: boolean;
};

export const DEFAULT_PUBLISH_POLICY: PublishPolicy = {
  defaultStatus: 'draft',
  publisherMustDiffer: true,
};

/** Default policy when no database rows exist or the table is unavailable. */
export function readPublishPolicy(): PublishPolicy {
  return { ...DEFAULT_PUBLISH_POLICY };
}

export type ContentActor = {
  roleType: string;
  email: string;
};

export type GuardEffect =
  | { type: 'ignore' }
  | { type: 'forbid'; message: string }
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
  findMany: (params: {
    status?: string;
    filters?: Record<string, unknown>;
  }) => Promise<Array<Record<string, unknown>>>;
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
    publishGuardLinked?: boolean;
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
      findOne: (
        params: Record<string, unknown>,
      ) => Promise<Record<string, unknown> | null>;
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
  options?: {
    policy?: PublishPolicy;
    enteredBy?: string | null;
    linkedPublish?: boolean;
  },
): GuardEffect {
  if (!GUARDED_UIDS.has(uid)) {
    return { type: 'ignore' };
  }

  const policy = options?.policy ?? DEFAULT_PUBLISH_POLICY;
  const writing = action === 'create' || action === 'update';
  const publishing =
    action === 'publish' ||
    action === 'unpublish' ||
    (writing && status === 'published');

  if (actor && actor.roleType !== 'editor' && publishing) {
    return { type: 'forbid', message: PUBLISH_FORBIDDEN };
  }

  if (!actor) {
    return { type: 'ignore' };
  }

  if (writing && status === 'published' && policy.defaultStatus === 'draft') {
    return { type: 'forbid', message: DRAFT_ONLY };
  }

  if (
    !options?.linkedPublish &&
    policy.publisherMustDiffer &&
    publishing &&
    action !== 'unpublish' &&
    samePerson(
      action === 'create' ? actor.email : options?.enteredBy,
      actor.email,
    )
  ) {
    return { type: 'forbid', message: SAME_PERSON };
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
    role &&
    typeof role === 'object' &&
    'type' in role &&
    typeof role.type === 'string'
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

function samePerson(
  enteredBy: string | null | undefined,
  publisherEmail: string,
): boolean {
  const creator = enteredBy?.trim().toLowerCase() ?? '';
  const publisher = publisherEmail.trim().toLowerCase();
  return creator.length > 0 && creator === publisher;
}

/**
 * Fields missing from a transaction write.
 * On update, an omitted key keeps the stored value. `connect: []` without
 * `set` is that same no-op. A create must include every required field.
 */
export function missingTransactionFields(
  data: Record<string, unknown> | undefined,
  action: 'create' | 'update',
): TransactionDraftRequiredField[] {
  const source = data ?? {};
  return TRANSACTION_DRAFT_REQUIRED_FIELDS.filter((field) => {
    if (action === 'update' && !(field in source)) return false;
    return !transactionFieldFilled(field, source[field], action);
  });
}

function transactionFieldFilled(
  field: TransactionDraftRequiredField | TransactionPublishRequiredField,
  value: unknown,
  action: 'create' | 'update',
): boolean {
  if (field === 'date') return dateFilled(value);
  if (field === 'amount') return amountFilled(value);
  if (field === 'description') return descriptionFilled(value);
  return relationFilled(value, action);
}

function descriptionFilled(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function dateFilled(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim());
}

function amountFilled(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string' || value.trim() === '') return false;
  return Number.isFinite(Number(value));
}

function relationFilled(value: unknown, action: 'create' | 'update'): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value))
    return value.some((item) => relationFilled(item, action));
  if (!value || typeof value !== 'object') return false;

  const row = value as Record<string, unknown>;
  if ('set' in row) return relationFilled(row.set, action);
  if ('connect' in row) {
    if (relationFilled(row.connect, action)) return true;
    return action === 'update';
  }
  if ('disconnect' in row) return false;
  if (typeof row.documentId === 'string')
    return row.documentId.trim().length > 0;
  if ('id' in row) return relationFilled(row.id, action);
  return false;
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

/** Bypass SAME_PERSON for nested/system publishes (linked receipts, Convert steps). */
export async function withPublishGuardLinked<T>(
  strapi: Pick<PublishGuardStrapi, 'requestContext'>,
  run: () => Promise<T>,
): Promise<T> {
  const state = strapi.requestContext.get()?.state;
  if (state) state.publishGuardLinked = true;
  try {
    return await run();
  } finally {
    if (state) state.publishGuardLinked = false;
  }
}

async function publishLinkedReceipts(
  strapi: PublishGuardStrapi,
  documentId: string,
) {
  const rows = await strapi.documents(RECEIPT_UID).findMany({
    status: 'draft',
    filters: { transaction: { documentId: { $eq: documentId } } },
  });
  const receiptIds = rows
    .map((row) => relationDocumentId(row))
    .filter((id): id is string => Boolean(id));
  if (receiptIds.length === 0) {
    return;
  }

  await withPublishGuardLinked(strapi, async () => {
    for (const receiptId of receiptIds) {
      await strapi.documents(RECEIPT_UID).publish({ documentId: receiptId });
    }
  });
}

async function storedEnteredBy(
  strapi: PublishGuardStrapi,
  uid: string,
  documentId: string | undefined,
): Promise<string | undefined> {
  if (!documentId) return undefined;
  const row = await strapi.db.query(uid).findOne({
    where: { documentId, publishedAt: { $null: true } },
  });
  return typeof row?.entered_by === 'string' ? row.entered_by : undefined;
}

async function storedDraftTransaction(
  strapi: PublishGuardStrapi,
  documentId: string,
): Promise<Record<string, unknown> | null> {
  return strapi.db.query(TRANSACTION_UID).findOne({
    where: { documentId, publishedAt: { $null: true } },
    populate: {
      organization: true,
      debit_account: true,
      credit_account: true,
      currency_type: true,
    },
  });
}

function storedRelationPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if ('id' in row && row.id != null) return true;
  if (typeof row.documentId === 'string' && row.documentId.trim().length > 0) {
    return true;
  }
  return false;
}

export function missingStoredPublishFields(
  row: Record<string, unknown> | null | undefined,
): TransactionPublishRequiredField[] {
  if (!row) {
    return [...TRANSACTION_PUBLISH_REQUIRED_FIELDS];
  }
  return TRANSACTION_PUBLISH_REQUIRED_FIELDS.filter((field) => {
    if (
      field === 'organization' ||
      field === 'debit_account' ||
      field === 'credit_account' ||
      field === 'currency_type'
    ) {
      return !storedRelationPresent(row[field]);
    }
    return !transactionFieldFilled(field, row[field], 'update');
  });
}

/**
 * Convert may publish generated steps while the source still lacks optional
 * draft fields (organization / accounts). Only publish the source when the
 * stored draft already meets the seven publish-required fields.
 */
export function shouldPublishConvertedSource(
  storedDraft: Record<string, unknown> | null | undefined,
  stepsPublished: boolean,
): boolean {
  return (
    stepsPublished && missingStoredPublishFields(storedDraft).length === 0
  );
}

async function assertStoredTransactionPublishable(
  strapi: PublishGuardStrapi,
  documentId: string | undefined,
) {
  if (!documentId) {
    throw new errors.ValidationError(
      'Missing required transaction fields: date, amount, currency_type, description, organization, debit_account, credit_account',
      {
        errors: TRANSACTION_PUBLISH_REQUIRED_FIELDS.map((path) => ({
          path: [path],
          message: `${path} is a required field`,
          name: 'ValidationError',
        })),
      },
    );
  }
  const row = await storedDraftTransaction(strapi, documentId);
  const missing = missingStoredPublishFields(row);
  if (missing.length === 0) {
    return;
  }
  throw new errors.ValidationError(
    `Missing required transaction fields: ${missing.join(', ')}`,
    {
      errors: missing.map((path) => ({
        path: [path],
        message: `${path} is a required field`,
        name: 'ValidationError',
      })),
    },
  );
}

export type PublishPolicyLoader = () => Promise<PublishPolicy>;

export function registerPublishGuard(
  strapi: PublishGuardStrapi,
  loadPolicy: PublishPolicyLoader = async () => readPublishPolicy(),
) {
  strapi.documents.use(async (context, next) => {
    if (!GUARDED_UIDS.has(context.uid)) {
      return next();
    }

    const policy = await loadPolicy();
    const actor = await contentApiActor(strapi);
    const requestState = strapi.requestContext.get()?.state;
    const linkedPublish = requestState?.publishGuardLinked === true;
    const status = context.params?.status;
    const writing = context.action === 'create' || context.action === 'update';
    const needsCreator =
      actor != null &&
      (context.action === 'publish' || (writing && status === 'published'));
    const enteredBy =
      needsCreator && context.action !== 'create'
        ? await storedEnteredBy(strapi, context.uid, context.params?.documentId)
        : undefined;
    const effect = guardEffect(context.uid, context.action, status, actor, {
      policy,
      enteredBy,
      linkedPublish,
    });

    if (effect.type === 'forbid') {
      throw new errors.ForbiddenError(effect.message);
    }

    const writingTransaction =
      context.uid === TRANSACTION_UID &&
      (context.action === 'create' || context.action === 'update');
    if (writingTransaction && strapi.requestContext.get()) {
      const missing = missingTransactionFields(
        asData(context.params?.data),
        context.action === 'update' ? 'update' : 'create',
      );
      if (missing.length > 0) {
        throw new errors.ValidationError(
          `Missing required transaction fields: ${missing.join(', ')}`,
          {
            errors: missing.map((path) => ({
              path: [path],
              message: `${path} is a required field`,
              name: 'ValidationError',
            })),
          },
        );
      }
    }

    if (
      context.uid === TRANSACTION_UID &&
      context.action === 'publish' &&
      actor != null &&
      strapi.requestContext.get()
    ) {
      await assertStoredTransactionPublishable(
        strapi,
        context.params?.documentId,
      );
    }

    if (effect.type === 'ignore') {
      return next();
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
        await publishLinkedReceipts(strapi, documentId);
      }
    }

    return result;
  });
}
