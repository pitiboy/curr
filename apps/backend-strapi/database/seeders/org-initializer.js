'use strict';

/**
 * Organization Initializer
 * Creates organization structure with child organizations and accounts
 */

module.exports = {
  async initialize({
    strapi,
    organizationName,
    childOrgLevel = 0,
    seedAccounts = false,
  }) {
    console.log('🏢 Starting organization initialization...');

    try {
      // Create main organization
      const organization = await createMainOrganization(
        strapi,
        organizationName
      );

      // Create child organizations based on level
      if (childOrgLevel > 0) {
        await createChildOrganizations(strapi, organization.id, childOrgLevel);
      }

      // Seed accounts if requested
      if (seedAccounts) {
        await seedOrganizationAccounts(strapi, organization.id);
      }

      console.log('✅ Organization initialization completed successfully!');
      return organization;
    } catch (error) {
      console.error('❌ Error during organization initialization:', error);
      throw error;
    }
  },
};

async function createMainOrganization(strapi, name) {
  console.log('🏢 Creating main organization...');

  const existingOrg = await strapi.entityService.findMany(
    'api::organization.organization',
    { filters: { name } }
  );

  if (existingOrg.length > 0) {
    console.log(`🏢 Organization "${name}" already exists, using existing...`);
    return existingOrg[0];
  }

  const organization = await strapi.entityService.create(
    'api::organization.organization',
    {
      data: {
        name,
        description: '',
        address: '',
      },
    }
  );

  console.log(`✅ Created organization: ${organization.name}`);
  return organization;
}

async function createChildOrganizations(strapi, parentOrgId, level) {
  console.log(`🏢 Creating child organizations (level ${level})...`);

  const childOrganizations = getChildOrganizationsByLevel(level);

  for (const childOrg of childOrganizations) {
    await strapi.entityService.create('api::organization.organization', {
      data: {
        name: childOrg.name,
        description: childOrg.description || '',
        address: '',
        parent: parentOrgId,
      },
    });
  }

  console.log(`✅ Created ${childOrganizations.length} child organizations`);
}

/**
 * Get child organizations by level
 * @param {number} level - The level of the child organizations
 * @returns {Array} - The child organizations
 * Child Organizations:
0. Vezetés 
0.1 Alapító(k)
0.19 KÜLKAPCSOLATI IGAZGATÁS
0.20 OPERATÍV VEZETÉS
1. Kommunikációs Központ
1.1. IRÁNYÍTÁS ÉS SZEMÉLYZETI KÖZPONT
1.2. KOMMUNIKÁCIÓS KÖZPONT
1.2.2 KIMENŐ KOMMUNIKÁCIÓS KÖZPONT
1.2.3 BELSŐ KOMMUNIKÁCIÓS KÖZPONT
1.3 VIZSGÁLATOK ÉS JELENTÉSEK
2. Marketing Központ
2.4 PROMÓCIÓ ÉS MARKETING IGAZGATÓSÁG
2.5 KIADVÁNYOK
2.6. REGISZTRÁCIÓS KÖZPONT
3. Pénzügyi Központ
3.7 BEVÉTELI KÖZPONT
3.8 KIFIZETÉSI KÖZPONT
3.9 NYILVÁNTARTÁSOK, VAGYONTÁRGYAK
4. Termelési Központ
4.10 TERVEZÉSI KÖZPONT
4.11 TERÜLET KIALAKÍTÁS
4.12 TERMELÉS IRÁNYÍTÁS
4.12.1 MEZŐ- ÉS ERDŐGAZDÁLKODÁS
5. Minőségfelügyeleti Központ
5.13 ÉRVÉNYESÍTÉS
5.14 MUNKATÁRS FEJLESZTÉS
5.15 KORREKCIÓS KÖZPONT
6. Terjesztési Központ
6.16 KAPCSOLATFELVÉTEL
6.17 TERÜLETI TÁMOGATÁS
6.18 TERÜLETEK FELÜGYELETE
 */
function getChildOrganizationsByLevel(level) {
  const allChildOrgs = [
    // Level 0 - Vezetés
    { name: 'Vezetés', description: 'Fővezetés és irányítás' },
    { name: 'Alapító(k)', description: 'Alapítók és tulajdonosok' },
    {
      name: 'KÜLKAPCSOLATI IGAZGATÁS',
      description: 'Külső kapcsolatok kezelése',
    },
    { name: 'OPERATÍV VEZETÉS', description: 'Napi működés irányítása' },

    // Level 1 - Központok
    {
      name: 'Kommunikációs Központ',
      description: 'Kommunikáció és kapcsolattartás',
    },
    { name: 'Marketing Központ', description: 'Marketing és promóció' },
    { name: 'Pénzügyi Központ', description: 'Pénzügyi ügyek kezelése' },
    { name: 'Termelési Központ', description: 'Termelés irányítása' },
    {
      name: 'Minőségfelügyeleti Központ',
      description: 'Minőség és ellenőrzés',
    },
    { name: 'Terjesztési Központ', description: 'Terjesztés és logisztika' },

    // Level 2 - Részlegek
    {
      name: 'IRÁNYÍTÁS ÉS SZEMÉLYZETI KÖZPONT',
      description: 'Személyzeti ügyek',
    },
    { name: 'KOMMUNIKÁCIÓS KÖZPONT', description: 'Kommunikációs feladatok' },
    { name: 'KIMENŐ KOMMUNIKÁCIÓS KÖZPONT', description: 'Külső kommunikáció' },
    { name: 'BELSŐ KOMMUNIKÁCIÓS KÖZPONT', description: 'Belső kommunikáció' },
    {
      name: 'VIZSGÁLATOK ÉS JELENTÉSEK',
      description: 'Elemzések és jelentések',
    },
    {
      name: 'PROMÓCIÓ ÉS MARKETING IGAZGATÓSÁG',
      description: 'Marketing stratégiák',
    },
    { name: 'KIADVÁNYOK', description: 'Kiadói tevékenység' },
    { name: 'REGISZTRÁCIÓS KÖZPONT', description: 'Regisztrációs feladatok' },
    { name: 'BEVÉTELI KÖZPONT', description: 'Bevételek kezelése' },
    { name: 'KIFIZETÉSI KÖZPONT', description: 'Kifizetések kezelése' },
    { name: 'NYILVÁNTARTÁSOK, VAGYONTÁRGYAK', description: 'Vagyonkezelés' },
    { name: 'TERVEZÉSI KÖZPONT', description: 'Tervezési feladatok' },
    { name: 'TERÜLET KIALAKÍTÁS', description: 'Területfejlesztés' },
    { name: 'TERMELÉS IRÁNYÍTÁS', description: 'Termelésirányítás' },
    { name: 'ÉRVÉNYESÍTÉS', description: 'Érvényesítési feladatok' },
    { name: 'MUNKATÁRS FEJLESZTÉS', description: 'Személyzetfejlesztés' },
    { name: 'KORREKCIÓS KÖZPONT', description: 'Hibaelhárítás' },
    { name: 'KAPCSOLATFELVÉTEL', description: 'Új kapcsolatok építése' },
    { name: 'TERÜLETI TÁMOGATÁS', description: 'Területi támogatás' },
    { name: 'TERÜLETEK FELÜGYELETE', description: 'Területfelügyelet' },

    // Level 3 - Részletes részlegek
    {
      name: 'MEZŐ- ÉS ERDŐGAZDÁLKODÁS',
      description: 'Mezőgazdasági és erdészeti tevékenység',
    },
  ];

  // Return organizations based on level
  switch (level) {
    case 1:
      return allChildOrgs.slice(0, 4); // Vezetés level
    case 2:
      return allChildOrgs.slice(0, 10); // Vezetés + Központok
    case 3:
      return allChildOrgs; // All levels
    default:
      return [];
  }
}

async function seedOrganizationAccounts(strapi, organizationId) {
  console.log('💰 Seeding organization accounts...');

  // Get account categories first
  const accountCategories = await strapi.entityService.findMany(
    'api::account-category.account-category'
  );

  const categoryMap = {};
  accountCategories.forEach((cat) => {
    categoryMap[cat.type] = cat.id;
  });

  const accounts = [
    // Bevételi számlák (Revenue)
    { name: 'Termékértékesítés', code: '400', category: categoryMap.revenue },
    {
      name: 'Szolgáltatásértékesítés',
      code: '401',
      category: categoryMap.revenue,
    },
    { name: 'Bérbeadás bevétele', code: '402', category: categoryMap.revenue },
    { name: 'Pénzügyi bevételek', code: '403', category: categoryMap.revenue },
    { name: 'Egyéb bevételek', code: '404', category: categoryMap.revenue },

    // Költségszámlák (Expense)
    { name: 'Anyagköltség', code: '500', category: categoryMap.expense },
    { name: 'Bérköltség', code: '501', category: categoryMap.expense },
    {
      name: 'Társadalombiztosítási költség',
      code: '502',
      category: categoryMap.expense,
    },
    { name: 'Rezsiköltség', code: '503', category: categoryMap.expense },
    { name: 'Szállítóköltség', code: '504', category: categoryMap.expense },
    {
      name: 'Értékesítési költség',
      code: '505',
      category: categoryMap.expense,
    },
    { name: 'Általános költség', code: '506', category: categoryMap.expense },
    { name: 'Pénzügyi költség', code: '507', category: categoryMap.expense },

    // Eszközszámlák (Asset)
    { name: 'Készpénz', code: '100', category: categoryMap.asset },
    { name: 'Bankszámla', code: '101', category: categoryMap.asset },
    { name: 'Követelések', code: '102', category: categoryMap.asset },
    { name: 'Készlet', code: '103', category: categoryMap.asset },
    { name: 'Berendezések', code: '104', category: categoryMap.asset },
    { name: 'Ingatlanok', code: '105', category: categoryMap.asset },

    // Kötelezettségszámlák (Liability)
    { name: 'Tartozások', code: '200', category: categoryMap.liability },
    { name: 'Adótartozások', code: '201', category: categoryMap.liability },
    { name: 'Bértartozások', code: '202', category: categoryMap.liability },
    {
      name: 'Hosszú lejáratú kötelezettségek',
      code: '203',
      category: categoryMap.liability,
    },

    // Tőkeszámlák (Equity)
    { name: 'Alaptőke', code: '300', category: categoryMap.equity },
    { name: 'Tartalékok', code: '301', category: categoryMap.equity },
    { name: 'Eredménytartalék', code: '302', category: categoryMap.equity },
  ];

  for (const account of accounts) {
    await strapi.entityService.create('api::account.account', {
      data: {
        ...account,
        organization: organizationId,
        description: `${account.name} számla`,
      },
    });
  }

  console.log(`✅ Created ${accounts.length} accounts for organization`);
}
