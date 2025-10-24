import { Data } from '@strapi/strapi';

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
        }
      )) as Data.ContentType<'api::organization.organization'>[];

      if (organizations.length > 0) {
        const mainOrg = organizations[0];

        // Create the account
        const account = (await strapi.entityService.create(
          'api::account.account',
          {
            data: {
              name: `${identifier} - Tagi számla`,
              code: '1001',
              organization: mainOrg.id,
            },
          }
        )) as Data.ContentType<'api::account.account'>;

        strapi.log.info(
          `✅ Created account:, ${JSON.stringify({
            accountName: account.name,
            accountId: account.id,
            accountCode: account.code,
          })}`
        );

        return account.id;
      } else {
        strapi.log.warn('⚠️ No organization found, cannot create account');
      }
    } else {
      strapi.log.info(
        `ℹ️ Account already provided (${
          typeof account === 'object' && 'id' in account ? account.id : account
        }), skipping creation`
      );
    }
  } catch (error) {
    strapi.log.error('❌ Error creating account:', error);
    throw error;
  }

  return undefined;
}

export default {
  async beforeCreate(event: LifecycleEvent) {
    strapi.log.info('🔄 Member beforeCreate hook triggered');
    const {
      params: { data: member },
    } = event;
    strapi.log.info(`📊 Created member: ${member.name}`);

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
