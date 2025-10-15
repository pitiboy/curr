'use strict';

/**
 * Initial data seeder for CURR system
 * Seeds basic data when database is empty
 */

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
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
        '🌱 Skipping seeding in production (set FORCE_SEED=true to override)'
      );
      return;
    }

    console.log('🌱 Starting initial data seeding...');

    try {
      // Seed Organization
      await seedOrganization(strapi);

      // Seed Transaction Types
      await seedTransactionTypes(strapi);

      // Seed Divisions
      await seedDivisions(strapi);

      // Seed Currency Types
      await seedCurrencyTypes(strapi);

      console.log('✅ Initial data seeding completed successfully!');
    } catch (error) {
      console.error('❌ Error during seeding:', error);
      // Don't throw error to prevent app startup failure
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

async function seedDivisions(strapi) {
  const existingDivisions = await strapi.entityService.findMany(
    'api::division.division'
  );

  if (existingDivisions.length === 0) {
    console.log('🏢 Seeding Divisions...');

    // Get the organization first
    const orgs = await strapi.entityService.findMany(
      'api::organization.organization',
      {
        limit: 1,
      }
    );

    let organizationId = null;
    if (orgs.length > 0) {
      organizationId = orgs[0].id;
      console.log(
        `🔗 Linking divisions to organization: ${orgs[0].name} (ID: ${organizationId})`
      );
    } else {
      console.log(
        '⚠️ No organization found, divisions will be seeded without an organization link.'
      );
    }

    const divisions = [
      {
        name: '1.1. IRÁNYÍTÁS ÉS SZEMÉLYZETI KÖZPONT',
        description: 'Vezetés és személyzeti ügyek központja',
        organization: organizationId,
      },
      {
        name: '1.2. KOMMUNIKÁCIÓS KÖZPONT',
        description: 'A szervezet kommunikációs tevékenységeinek központja',
        organization: organizationId,
      },
      {
        name: '1.2.2 KIMENŐ KOMMUNIKÁCIÓS KÖZPONT',
        description: 'Kifelé irányuló kommunikációért felelős központ',
        organization: organizationId,
      },
      {
        name: '1.2.3 BELSŐ KOMMUNIKÁCIÓS KÖZPONT',
        description: 'Belső kommunikációért felelős központ',
        organization: organizationId,
      },
      {
        name: '1.3 VIZSGÁLATOK ÉS JELENTÉSEK',
        description: 'Vizsgálatok és jelentések készítésének központja',
        organization: organizationId,
      },
      {
        name: '2.4 PROMÓCIÓ ÉS MARKETING IGAZGATÓSÁG',
        description: 'Promóciós és marketing tevékenységek igazgatósága',
        organization: organizationId,
      },
      {
        name: '2.5 KIADVÁNYOK',
        description: 'Kiadványok szerkesztése és terjesztése',
        organization: organizationId,
      },
      {
        name: '2.6. REGISZTRÁCIÓS KÖZPONT',
        description: 'Tagok és adatok regisztrációjának központja',
        organization: organizationId,
      },
      {
        name: '3.7 BEVÉTELI KÖZPONT',
        description: 'Bevételek kezelésének és gyűjtésének központja',
        organization: organizationId,
      },
      {
        name: '3.8 KIFIZETÉSI KÖZPONT',
        description: 'Kifizetések kezelésének és lebonyolításának központja',
        organization: organizationId,
      },
      {
        name: '3.9 NYILVÁNTARTÁSOK, VAGYONTÁRGYAK',
        description: 'Nyilvántartások és vagyontárgyak kezelése',
        organization: organizationId,
      },
      {
        name: '4.10 TERVEZÉSI KÖZPONT',
        description: 'Stratégiai és operatív tervezés központja',
        organization: organizationId,
      },
      {
        name: '4.11 TERÜLET KIALAKÍTÁS',
        description: 'Területek fejlesztése és kialakítása',
        organization: organizationId,
      },
      {
        name: '4.12 TERMELÉS IRÁNYÍTÁS',
        description: 'Termelési folyamatok irányítása és felügyelete',
        organization: organizationId,
      },
      {
        name: '4.12.1 MEZŐ- ÉS ERDŐGAZDÁLKODÁS',
        description: 'Mezőgazdasági és erdőgazdálkodási tevékenységek',
        organization: organizationId,
      },
      {
        name: '5.13 ÉRVÉNYESÍTÉS',
        description: 'Szabályok és eljárások érvényesítése',
        organization: organizationId,
      },
      {
        name: '5.14 MUNKATÁRS FEJLESZTÉS',
        description: 'Munkatársak képzése és fejlesztése',
        organization: organizationId,
      },
      {
        name: '5.15 KORREKCIÓS KÖZPONT',
        description: 'Hibák és eltérések korrekciójának központja',
        organization: organizationId,
      },
      {
        name: '6.A KAPCSOLATFELVÉTEL',
        description: 'Külső és belső kapcsolatfelvétel kezelése',
        organization: organizationId,
      },
      {
        name: '6.B TERÜLETI TÁMOGATÁS',
        description: 'Területi egységek támogatása és koordinálása',
        organization: organizationId,
      },
      {
        name: '6.C TERÜLETEK FELÜGYELETe',
        description: 'Területi tevékenységek felügyelete és ellenőrzése',
        organization: organizationId,
      },
    ];

    for (const division of divisions) {
      await strapi.entityService.create('api::division.division', {
        data: division,
      });
    }

    console.log(`✅ Created ${divisions.length} divisions`);
  } else {
    console.log('🏢 Divisions already exist, skipping...');
  }
}

async function seedCurrencyTypes(strapi) {
  const existingCurrencies = await strapi.entityService.findMany(
    'api::currency-type.currency-type'
  );

  if (existingCurrencies.length === 0) {
    console.log('💱 Seeding Currency Types...');

    const currencyTypes = [
      {
        code: 'HUF',
        name: 'Magyar Forint',
        category: 'cash',
        unit: 'HUF',
      },
      {
        code: 'EUR',
        name: 'Euro',
        category: 'cash',
        unit: 'EUR',
      },
      {
        code: 'HOUR',
        name: 'emberi munkaóra',
        category: 'labor',
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
