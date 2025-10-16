'use strict';

module.exports = {
  async beforeCreate(event) {
    console.log('🔄 Member beforeCreate hook triggered');
    
    const { data } = event.params;
    console.log('📊 Creating member:', data.name);

    // Only create account if not already provided
    if (!data.account) {
      console.log('💰 Creating account for member...');

      // Get the main organization
      const organizations = await strapi.entityService.findMany('api::organization.organization', {
        sort: { createdAt: 'asc' },
        limit: 1,
      });

      if (organizations.length > 0) {
        const mainOrg = organizations[0];
        
        // Create the account
        const account = await strapi.entityService.create('api::account.account', {
          data: {
            name: `${data.name} - Tagi számla`,
            code: `M${Date.now()}`,
            organization: mainOrg.id,
          },
        });

        console.log('✅ Created account:', account.name);
        
        // Link the account to the member
        data.account = account.id;
      }
    }
  },

  async beforeUpdate(event) {
    console.log('🔄 Member beforeUpdate hook triggered');
    
    const { data, where } = event.params;
    
    // Get existing member
    const existingMember = await strapi.entityService.findOne('api::member.member', where.id, {
      populate: ['account'],
    });

    if (existingMember && !existingMember.account) {
      console.log('⚠️ Member has no account, creating one...');
      
      // Get the main organization
      const organizations = await strapi.entityService.findMany('api::organization.organization', {
        sort: { createdAt: 'asc' },
        limit: 1,
      });

      if (organizations.length > 0) {
        const mainOrg = organizations[0];
        
        // Create the account
        const account = await strapi.entityService.create('api::account.account', {
          data: {
            name: `${existingMember.name} - Tagi számla`,
            code: `M${Date.now()}`,
            organization: mainOrg.id,
          },
        });

        console.log('✅ Created account for existing member:', account.name);
        
        // Link the account to the member
        data.account = account.id;
      }
    }
  },
};
