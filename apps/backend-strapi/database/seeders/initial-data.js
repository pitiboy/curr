'use strict';

/**
 * Initial data seeder for CURR system
 * Seeds basic data when database is empty
 */

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Only run seeding in development or when explicitly requested
    if (process.env.NODE_ENV === 'production' && !process.env.FORCE_SEED) {
      console.log(
        '🌱 Skipping bootstrap seeding in production (set FORCE_SEED=true to override)'
      );
      return;
    }

    console.log('🌱 Starting bootstrap seeding...');

    try {
      // Seed Transaction Types
      await seedTransactionTypes(strapi);

      // Seed Currency Categories
      await seedCurrencyCategories(strapi);

      // Seed Currency Types
      await seedCurrencyTypes(strapi);

      // Seed Account Categories
      await seedAccountCategories(strapi);

      console.log('✅ Bootstrap seeding completed successfully!');
    } catch (error) {
      console.error('❌ Error during bootstrap seeding:', error);
      // Don't throw error to prevent app startup failure
    }
  },

  /**
   * Manual seeding function - call this explicitly when you want to seed organizations
   */
  async seed({ strapi }) {
    console.log('🌱 Starting manual organization seeding...');

    try {
      // Seed Organization only
      await seedOrganization(strapi);

      console.log('✅ Manual organization seeding completed successfully!');
    } catch (error) {
      console.error('❌ Error during manual organization seeding:', error);
      throw error; // Re-throw for manual seeding
    }
  },
};

async function seedOrganization(strapi) {
  const existingOrgs = await strapi.entityService.findMany(
    'api::organization.organization'
  );

  if (existingOrgs.length === 0) {
    console.log('📊 Seeding Organization...');

    const org = await strapi.entityService.create(
      'api::organization.organization',
      {
        data: {
          name: 'Zöld források szövetkezet @Szupatak',
          description: '',
          address: 'Szupatak, Hungary',
        },
      }
    );

    console.log(`✅ Created organization: ${org.name}`);
  } else {
    console.log('📊 Organization already exists, skipping...');
  }
}

async function seedTransactionTypes(strapi) {
  const existingTypes = await strapi.entityService.findMany(
    'api::transaction-type.transaction-type'
  );

  if (existingTypes.length === 0) {
    console.log('💰 Seeding Transaction Types...');

    const transactionTypes = [
      {
        name: 'Elrendelt',
        category: 'future',
        description: 'Tervezett/elrendelt kiadás',
      },
      {
        name: 'Utalás',
        category: 'actual',
        description: 'Banki átutalás',
      },
      {
        name: 'Készpénz',
        category: 'actual',
        description: 'Készpénzes fizetés',
      },
      {
        name: 'Átvezetés',
        category: 'internal',
        description: 'Belső átvezetés számlák között',
      },
      {
        name: 'Jutalék',
        category: 'actual',
        description: 'Jutalék vagy bónusz kifizetés',
      },
      {
        name: 'Barter',
        category: 'actual',
        description: 'Áru/szolgáltatás csere',
      },
    ];

    for (const type of transactionTypes) {
      await strapi.entityService.create(
        'api::transaction-type.transaction-type',
        {
          data: type,
        }
      );
    }

    console.log(`✅ Created ${transactionTypes.length} transaction types`);
  } else {
    console.log('💰 Transaction types already exist, skipping...');
  }
}

async function seedAccountCategories(strapi) {
  const existingCategories = await strapi.entityService.findMany(
    'api::account-category.account-category'
  );

  if (existingCategories.length === 0) {
    console.log('📊 Seeding Account Categories...');

    const accountCategories = [
      {
        name: 'Bevétel',
        type: 'revenue',
        description: 'Bevételi és jövedelmi számlák',
        color: '#10B981', // Green
      },
      {
        name: 'Költség',
        type: 'expense',
        description: 'Költség- és ráfordítási számlák',
        color: '#EF4444', // Red
      },
      {
        name: 'Eszköz',
        type: 'asset',
        description: 'Eszköz- és vagyonszámlák',
        color: '#3B82F6', // Blue
      },
      {
        name: 'Kötelezettség',
        type: 'liability',
        description: 'Kötelezettség- és tartozásszámlák',
        color: '#F59E0B', // Yellow
      },
      {
        name: 'Tőke',
        type: 'equity',
        description: 'Tőke- és saját tőkeszámlák',
        color: '#8B5CF6', // Purple
      },
    ];

    for (const category of accountCategories) {
      await strapi.entityService.create(
        'api::account-category.account-category',
        {
          data: category,
        }
      );
    }

    console.log(`✅ Created ${accountCategories.length} account categories`);
  } else {
    console.log('📊 Account categories already exist, skipping...');
  }
}

async function seedCurrencyCategories(strapi) {
  const existingCategories = await strapi.entityService.findMany(
    'api::currency-category.currency-category'
  );

  if (existingCategories.length === 0) {
    console.log('💱 Seeding Currency Categories...');

    const currencyCategories = [
      {
        code: 'CASH',
        name: 'Pénz',
        description: 'Hagyományos pénzügyi eszközök',
        icon: '💰',
        color: '#10B981',
      },
      {
        code: 'LABOUR',
        name: 'Munka',
        description: 'Idő- és munkalapú eszközök',
        icon: '⏰',
        color: '#3B82F6',
      },
      {
        code: 'RESOURCES',
        name: 'Erőforrás',
        description: 'Fizikai áruk és anyagok',
        icon: '🌾',
        color: '#F59E0B',
      },
      {
        code: 'ASSETS',
        name: 'Vagyon',
        description: 'Ingatlan és berendezések',
        icon: '🏠',
        color: '#8B5CF6',
      },
    ];

    for (const category of currencyCategories) {
      await strapi.entityService.create(
        'api::currency-category.currency-category',
        {
          data: category,
        }
      );
    }

    console.log(`✅ Created ${currencyCategories.length} currency categories`);
  } else {
    console.log('💱 Currency categories already exist, skipping...');
  }
}

async function seedCurrencyTypes(strapi) {
  const existingCurrencies = await strapi.entityService.findMany(
    'api::currency-type.currency-type'
  );

  if (existingCurrencies.length === 0) {
    console.log('💱 Seeding Currency Types...');

    // Get currency categories first
    const cashCategory = await strapi.entityService.findMany(
      'api::currency-category.currency-category',
      { filters: { code: 'CASH' } }
    );
    const laborCategory = await strapi.entityService.findMany(
      'api::currency-category.currency-category',
      { filters: { code: 'LABOUR' } }
    );

    const currencyTypes = [
      {
        code: 'HUF',
        name: 'Magyar Forint',
        category: cashCategory[0]?.id,
        unit: 'HUF',
      },
      {
        code: 'EUR',
        name: 'Euro',
        category: cashCategory[0]?.id,
        unit: 'EUR',
      },
      {
        code: 'HOUR',
        name: 'emberi munkaóra',
        category: laborCategory[0]?.id,
        unit: 'hour',
      },
    ];

    for (const currency of currencyTypes) {
      await strapi.entityService.create('api::currency-type.currency-type', {
        data: currency,
      });
    }

    console.log(`✅ Created ${currencyTypes.length} currency types`);
  } else {
    console.log('💱 Currency types already exist, skipping...');
  }
}
