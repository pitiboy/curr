/**
 * Every member has two one-to-one accounts, created automatically:
 * - `account`: code 1101, "<identifier> - tagi számla" (member account)
 * - `private_account`: code 1001, "<identifier> - saját számla" (the member's
 *   own, informal "homály" pocket)
 *
 * The member lifecycle (beforeCreate/beforeUpdate) fills in whichever is
 * missing: first reconnects an existing account with the expected name, else
 * creates one (with a "(n)" name tail if that name is already taken). The
 * bootstrap backfill does the same for existing members.
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
 * `base`, or `base (2)`, `base (3)`… if taken — so a recreate after disconnect
 * does not collide with an orphan that another member already reclaimed.
 */
export function uniqueMemberAccountName(
  base: string,
  taken: Iterable<string>,
): string {
  const used = new Set(taken);
  if (!used.has(base)) {
    return base;
  }
  let n = 2;
  while (used.has(`${base} (${n})`)) {
    n += 1;
  }
  return `${base} (${n})`;
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
 * True when the write payload clears the relation (so after the update the
 * stored link will be gone). Empty `{ connect: [], disconnect: [] }` is a
 * no-op, not a clear — Content Manager sometimes sends that for untouched
 * fields. A non-empty `disconnect` or an empty `set` is a clear.
 */
export function payloadClearsRelation(value: unknown): boolean {
  if (value === undefined) return false;
  if (value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value !== 'object') return false;
  if (payloadHasRelationTarget(value)) return false;
  const obj = value as Record<string, unknown>;
  if ('set' in obj) {
    const list = obj.set;
    return Array.isArray(list) ? list.length === 0 : list == null;
  }
  if ('disconnect' in obj) {
    const list = obj.disconnect;
    return Array.isArray(list) ? list.length > 0 : !!list;
  }
  return false;
}

/**
 * Which account relations to create or reconnect. A relation is skipped when
 * the payload sets it, or when the stored member already has it — unless the
 * payload is clearing it (disconnect / set []), in which case the stored link
 * will be gone after the update and must be filled again.
 */
export function missingMemberAccounts(
  payload: Partial<Record<MemberAccountField, unknown>>,
  existing: Partial<Record<MemberAccountField, unknown>> | null | undefined,
): MemberAccountKind[] {
  return MEMBER_ACCOUNT_KINDS.filter((kind) => {
    if (payloadHasRelationTarget(payload[kind.field])) return false;
    if (payloadClearsRelation(payload[kind.field])) return true;
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

async function accountLinkedToOtherMember(
  strapi: StrapiForMemberAccounts,
  accountId: number | string,
  memberId: number | string | null | undefined,
): Promise<boolean> {
  const where: Record<string, unknown> = {
    $or: [{ account: { id: accountId } }, { private_account: { id: accountId } }],
  };
  if (memberId !== null && memberId !== undefined) {
    where.id = { $ne: memberId };
  }
  const owner = await strapi.db.query(MEMBER_UID).findOne({
    where,
    select: ['id'],
  });
  return !!owner;
}

/**
 * Prefer an existing account with the canonical name + code that is not already
 * linked to another member (orphans from a prior disconnect are fine).
 */
async function findReusableMemberAccount(
  strapi: StrapiForMemberAccounts,
  options: {
    name: string;
    code: string;
    memberId?: number | string | null;
  },
): Promise<{ id: number | string; name: string } | null> {
  const candidates = await strapi.db.query(ACCOUNT_UID).findMany({
    where: { name: options.name, code: options.code },
    select: ['id', 'name', 'code'],
    orderBy: { createdAt: 'asc' },
  });
  for (const account of candidates) {
    if (
      !(await accountLinkedToOtherMember(strapi, account.id, options.memberId))
    ) {
      return account;
    }
  }
  return null;
}

async function nextUniqueAccountName(
  strapi: StrapiForMemberAccounts,
  base: string,
): Promise<string> {
  const rows = await strapi.db.query(ACCOUNT_UID).findMany({
    where: {
      $or: [{ name: base }, { name: { $startsWith: `${base} (` } }],
    },
    select: ['name'],
  });
  return uniqueMemberAccountName(
    base,
    rows.map((row) => String(row.name)),
  );
}

/**
 * Fills missing accounts into `data` (lifecycle payload or backfill update):
 * reconnect an orphan with the expected name when possible, otherwise create
 * (with a "(n)" name tail on collision). Returns the filled kinds.
 */
export async function createMissingMemberAccounts(
  strapi: StrapiForMemberAccounts,
  data: Record<string, unknown>,
  options: {
    identifier: string | null | undefined;
    existing?: Partial<Record<MemberAccountField, unknown>> | null;
    memberId?: number | string | null;
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
  const filled: MemberAccountKind[] = [];
  for (const kind of missing) {
    const baseName = memberAccountName(identifier, kind);
    const reusable = await findReusableMemberAccount(strapi, {
      name: baseName,
      code: kind.code,
      memberId: options.memberId,
    });
    if (reusable) {
      data[kind.field] = { id: reusable.id };
      filled.push(kind);
      strapi.log.info(
        `Reconnected member account "${reusable.name}" (${kind.code}, id ${reusable.id})`,
      );
      continue;
    }
    const name = await nextUniqueAccountName(strapi, baseName);
    // Document service, so the account gets a documentId like any other.
    const account = await strapi.documents(ACCOUNT_UID).create({
      data: {
        name,
        code: kind.code,
        organization,
      },
    });
    data[kind.field] = { id: account.id };
    filled.push(kind);
    strapi.log.info(
      `Created member account "${name}" (${kind.code}, id ${account.id})`,
    );
  }
  return filled;
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
        memberId: member.id,
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
