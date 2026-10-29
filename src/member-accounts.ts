/**
 * Every member has two one-to-one accounts, created automatically:
 * - `account`: code 1101, "<identifier> - tagi számla" (member account)
 * - `private_account`: code 1001, "<identifier> - saját számla" (the member's
 *   own, informal "homály" pocket)
 *
 * The member lifecycle (beforeCreate/beforeUpdate) fills in whichever is
 * missing, and the bootstrap backfill does the same for existing members.
 * Only the decision functions are pure; the rest talks to Strapi.
 */

const MEMBER_UID = 'api::member.member';
const ACCOUNT_UID = 'api::account.account';
const ORGANIZATION_UID = 'api::organization.organization';

export type MemberAccountField = 'account' | 'private_account';

export type MemberAccountKind = {
  field: MemberAccountField;
  code: string;
  suffix: string;
};

export const MEMBER_ACCOUNT_KINDS: readonly MemberAccountKind[] = [
  { field: 'account', code: '1101', suffix: 'tagi számla' },
  { field: 'private_account', code: '1001', suffix: 'saját számla' },
];

export function memberAccountName(
  identifier: string,
  kind: MemberAccountKind,
): string {
  return `${identifier} - ${kind.suffix}`;
}

/**
 * True when a relation value in a write payload points at an account:
 * an id, a documentId, `{ id }`, `{ documentId }`, or a non-empty
 * `connect`/`set`. `null`, `undefined`, `{ connect: [] }`, `{ disconnect: … }`
 * and `{ set: [] }` do not.
 */
export function payloadHasRelationTarget(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number' || typeof value === 'string') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.id !== undefined && obj.id !== null) return true;
    if (obj.documentId !== undefined && obj.documentId !== null) return true;
    for (const key of ['connect', 'set']) {
      const list = obj[key];
      if (
        Array.isArray(list) ? list.length > 0 : payloadHasRelationTarget(list)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Which account relations to create. A relation is skipped when the payload
 * sets it, or when the stored member already has it (an update payload
 * usually does not repeat relations, so the payload alone is not enough).
 */
export function missingMemberAccounts(
  payload: Partial<Record<MemberAccountField, unknown>>,
  existing: Partial<Record<MemberAccountField, unknown>> | null | undefined,
): MemberAccountKind[] {
  return MEMBER_ACCOUNT_KINDS.filter((kind) => {
    if (payloadHasRelationTarget(payload[kind.field])) return false;
    if (existing && payloadHasRelationTarget(existing[kind.field])) return false;
    return true;
  });
}

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string, ...rest: unknown[]) => void;
};

type DbQuery = {
  findOne: (params: Record<string, unknown>) => Promise<any>;
  findMany: (params: Record<string, unknown>) => Promise<any[]>;
  create: (params: { data: Record<string, unknown> }) => Promise<any>;
  update: (params: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<any>;
};

export type StrapiForMemberAccounts = {
  db: { query: (uid: string) => DbQuery };
  documents: (uid: string) => {
    create: (params: { data: Record<string, unknown> }) => Promise<any>;
  };
  log: Logger;
};

/** documentId of the oldest organization (the main one, as before). */
async function mainOrganizationId(
  strapi: StrapiForMemberAccounts,
): Promise<string | undefined> {
  const org = await strapi.db.query(ORGANIZATION_UID).findOne({
    select: ['id', 'documentId'],
    orderBy: { createdAt: 'asc' },
  });
  return org?.documentId;
}

/**
 * Creates the missing accounts and writes `{ id }` relations into `data`
 * (the lifecycle payload or the backfill update). Returns the created kinds.
 */
export async function createMissingMemberAccounts(
  strapi: StrapiForMemberAccounts,
  data: Record<string, unknown>,
  options: {
    identifier: string | null | undefined;
    existing?: Partial<Record<MemberAccountField, unknown>> | null;
  },
): Promise<MemberAccountKind[]> {
  const missing = missingMemberAccounts(data, options.existing);
  if (!missing.length) return [];
  const identifier = String(options.identifier ?? '').trim();
  if (!identifier) {
    strapi.log.warn('Member accounts skipped: the member has no identifier');
    return [];
  }
  const organization = await mainOrganizationId(strapi);
  if (!organization) {
    strapi.log.warn('Member accounts skipped: no organization found');
    return [];
  }
  for (const kind of missing) {
    // Document service, so the account gets a documentId like any other.
    const account = await strapi.documents(ACCOUNT_UID).create({
      data: {
        name: memberAccountName(identifier, kind),
        code: kind.code,
        organization,
      },
    });
    data[kind.field] = { id: account.id };
    strapi.log.info(
      `Created member account "${memberAccountName(identifier, kind)}" (${kind.code}, id ${account.id})`,
    );
  }
  return missing;
}

/** The stored member with its account relations, for beforeUpdate. */
export async function findMemberWithAccounts(
  strapi: StrapiForMemberAccounts,
  where: Record<string, unknown>,
) {
  return strapi.db.query(MEMBER_UID).findOne({
    where,
    select: ['id', 'identifier'],
    populate: {
      account: { select: ['id'] },
      private_account: { select: ['id'] },
    },
  });
}

/**
 * Idempotent bootstrap backfill: every member gets the accounts it lacks.
 * The update goes through the member lifecycle, which sees the relations in
 * the payload and does not create anything twice.
 */
export async function backfillMemberAccounts(
  strapi: StrapiForMemberAccounts,
): Promise<number> {
  const members = await strapi.db.query(MEMBER_UID).findMany({
    select: ['id', 'identifier'],
    populate: {
      account: { select: ['id'] },
      private_account: { select: ['id'] },
    },
  });
  let fixed = 0;
  for (const member of members) {
    if (!missingMemberAccounts({}, member).length) continue;
    const data: Record<string, unknown> = {};
    try {
      const created = await createMissingMemberAccounts(strapi, data, {
        identifier: member.identifier,
        existing: member,
      });
      if (!created.length) continue;
      await strapi.db
        .query(MEMBER_UID)
        .update({ where: { id: member.id }, data });
      fixed += 1;
    } catch (error) {
      strapi.log.error(
        `Member account backfill failed for member ${member.id}`,
        error,
      );
    }
  }
  strapi.log.info(
    fixed
      ? `Member account backfill: ${fixed} member(s) completed`
      : 'Member account backfill: nothing to do',
  );
  return fixed;
}
