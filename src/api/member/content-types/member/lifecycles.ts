import { Data } from '@strapi/strapi';

import {
  createMissingMemberAccounts,
  findMemberWithAccounts,
  type StrapiForMemberAccounts,
} from '../../../../member-accounts';
import {
  memberIdentifierBase,
  uniqueMemberIdentifier,
} from '../../../../member-identifier';

type MemberData = Data.ContentType<'api::member.member'>;

interface LifecycleEvent {
  action: string;
  model: string[];
  params: {
    data: Partial<MemberData>;
    select?: string[];
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    limit?: number;
    offset?: number;
    populate?: string[];
  };
  result?: MemberData;
  state?: Record<string, unknown>;
}

strapi.log.info('🔧 Lifecycle hooks loaded for member');

/**
 * The admin only pre-fills a uid field when it is required, and then from an
 * empty form, which gives the bare "member". The field is optional instead;
 * an empty identifier is generated from the name here (src/member-identifier.ts,
 * e.g. "kovács.erika"), before the member account named after it is created.
 */
async function ensureIdentifier(data: Partial<MemberData>): Promise<void> {
  const current =
    typeof data.identifier === 'string' ? data.identifier.trim() : '';
  if (current) {
    return;
  }
  if (typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('Member name is required to generate the identifier');
  }
  const base = memberIdentifierBase(data.name);
  if (!base) {
    throw new Error('Member name gives an empty identifier');
  }
  const existing = (await strapi.db.query('api::member.member').findMany({
    select: ['identifier'],
    where: { identifier: { $startsWith: base } },
  })) as Array<{ identifier: string }>;
  data.identifier = uniqueMemberIdentifier(
    base,
    existing.map((row) => row.identifier),
  ) as MemberData['identifier'];
}

const accountsStrapi = () => strapi as unknown as StrapiForMemberAccounts;

export default {
  async beforeCreate(event: LifecycleEvent) {
    const {
      params: { data: member },
    } = event;
    strapi.log.info(`Member beforeCreate: ${member.name}`);

    await ensureIdentifier(member);

    try {
      // Member account (1101) and private account (1001), unless given.
      await createMissingMemberAccounts(accountsStrapi(), member as Record<string, unknown>, {
        identifier: member.identifier,
      });
    } catch (error) {
      strapi.log.error('Member beforeCreate: creating the accounts failed', error);
    }
  },

  async beforeUpdate(event: LifecycleEvent) {
    const {
      params: { data: member, where },
    } = event;
    strapi.log.info(`Member beforeUpdate: ${member.name ?? ''} (${JSON.stringify(where)})`);

    if ('identifier' in member && !String(member.identifier ?? '').trim()) {
      if (typeof member.name !== 'string' || !member.name.trim()) {
        delete member.identifier;
      } else {
        await ensureIdentifier(member);
      }
    }

    try {
      // The update payload usually omits relations, so check the stored member;
      // otherwise every save would create a new account.
      const stored = where ? await findMemberWithAccounts(accountsStrapi(), where) : null;
      await createMissingMemberAccounts(accountsStrapi(), member as Record<string, unknown>, {
        identifier: member.identifier || stored?.identifier,
        existing: stored,
      });
    } catch (error) {
      strapi.log.error('Member beforeUpdate: creating the accounts failed', error);
    }
  },
};
