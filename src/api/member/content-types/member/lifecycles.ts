import { Data } from '@strapi/strapi';

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

async function createAccountForMember({
  account,
  identifier,
}: Partial<MemberData>): Promise<number | string | undefined> {
  try {
    // Check if account is already set (handle various formats)
    const hasAccount =
      account &&
      (typeof account === 'number' ||
        typeof account === 'string' ||
        (typeof account === 'object' && 'id' in account));

    // Only create account if not already provided
    if (!hasAccount) {
      strapi.log.info('💰 Creating account for member...');

      // Get the main organization
      const organizations = (await strapi.entityService.findMany(
        'api::organization.organization',
        {
          sort: { createdAt: 'asc' },
          limit: 1,
        },
      )) as Data.ContentType<'api::organization.organization'>[];

      if (organizations.length > 0) {
        const mainOrg = organizations[0];

        // Create the account
        const account = (await strapi.entityService.create(
          'api::account.account',
          {
            data: {
              name: `${identifier} - tagi számla`,
              code: '1001',
              organization: mainOrg.id,
            },
          },
        )) as Data.ContentType<'api::account.account'>;

        strapi.log.info(
          `✅ Created account:, ${JSON.stringify({
            accountName: account.name,
            accountId: account.id,
            accountCode: account.code,
          })}`,
        );

        return account.id;
      } else {
        strapi.log.warn('⚠️ No organization found, cannot create account');
      }
    } else {
      strapi.log.info(
        `ℹ️ Account already provided (${
          typeof account === 'object' && 'id' in account ? account.id : account
        }), skipping creation`,
      );
    }
  } catch (error) {
    strapi.log.error('❌ Error creating account:', error);
    throw error;
  }

  return undefined;
}

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

export default {
  async beforeCreate(event: LifecycleEvent) {
    strapi.log.info('🔄 Member beforeCreate hook triggered');
    const {
      params: { data: member },
    } = event;
    strapi.log.info(`📊 Created member: ${member.name}`);

    await ensureIdentifier(member);

    try {
      const accountId = await createAccountForMember(member);
      if (accountId) {
        event.params.data.account = { id: accountId as string } as never;
      }
    } catch (error) {
      strapi.log.error('❌ Error in afterCreate lifecycle:', error);
    }
  },

  async beforeUpdate(event: LifecycleEvent) {
    const {
      params: { data: member, where },
    } = event;

    strapi.log.info('🔄 Member afterUpdate hook triggered');
    strapi.log.info(`📊 Updated member: ${member.name} (id: ${where.id})`);

    if ('identifier' in member && !String(member.identifier ?? '').trim()) {
      if (typeof member.name !== 'string' || !member.name.trim()) {
        delete member.identifier;
      } else {
        await ensureIdentifier(member);
      }
    }

    try {
      const accountId = await createAccountForMember(member);
      if (accountId) {
        event.params.data.account = { id: accountId as string } as never;
      }
    } catch (error) {
      strapi.log.error('❌ Error in afterCreate lifecycle:', error);
    }
  },
};
