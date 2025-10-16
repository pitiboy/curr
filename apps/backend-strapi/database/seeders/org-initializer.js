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
  let totalCreated = 0;

  for (const childOrg of childOrganizations) {
    totalCreated += await createOrganizationRecursively(
      strapi,
      childOrg,
      parentOrgId
    );
  }

  console.log(`✅ Created ${totalCreated} child organizations`);
}

async function createOrganizationRecursively(strapi, orgData, parentId) {
  // Create the current organization
  const createdOrg = await strapi.entityService.create(
    'api::organization.organization',
    {
      data: {
        name: orgData.name,
        description: orgData.description || '',
        address: '',
        parent: parentId,
      },
    }
  );

  let count = 1; // Count this organization

  // Create children recursively if they exist
  if (orgData.children && orgData.children.length > 0) {
    for (const child of orgData.children) {
      count += await createOrganizationRecursively(
        strapi,
        child,
        createdOrg.id
      );
    }
  }

  return count;
}

/**
 * Get child organizations by level
 * @param {number} level - The level of the child organizations
 * @returns {Array} - The child organizations
 * Child Organizations:
 */
function getChildOrganizationsByLevel(level) {
  const hierarchicalOrgs = level > 0 && [
    // Level 0 - Vezetés
    {
      name: 'I/0. Vezetés',
      description: 'Fővezetés és irányítás',
      children: level > 1 && [
        {
          name: 'I/0.1 Alapító(k)',
          description: 'Alapítók és tulajdonosok',
        },
        {
          name: 'I/0.19 Külső kapcsolati igazgatás',
          description: 'Külső kapcsolatok kezelése',
        },
        {
          name: 'I/0.20 Operatív vezetés',
          description: 'Napi működés irányítása',
        },
      ],
    },

    // Level 1 - Központok
    {
      name: 'I/1. Kommunikációs Igazgatóság',
      description: 'Kommunikáció és kapcsolattartás',
      children: level > 1 && [
        {
          name: 'I/1.1 Irányítás és személyzeti központ',
          description: 'Személyzeti ügyek',
        },
        {
          name: 'I/1.2 Kommunikációs központ',
          description: 'Kommunikációs feladatok',
          children: level > 2 && [
            {
              name: 'I/1.2.2 Kimenő kommunikációs központ',
              description: 'Külső kommunikáció',
            },
            {
              name: 'I/1.2.3 Belső kommunikációs központ',
              description: 'Belső kommunikáció',
            },
          ],
        },
        {
          name: 'I/1.3 Vizsgálatok és jelentések',
          description: 'Elemzések és jelentések',
        },
      ],
    },

    {
      name: 'I/2. Marketing Igazgatóság',
      description: 'Marketing és promóció',
      children: level > 1 && [
        {
          name: 'I/2.4 Promóció és marketing igazgatóság',
          description: 'Marketing stratégiák',
        },
        {
          name: 'I/2.5 Kiadványok',
          description: 'Kiadói tevékenység',
        },
        {
          name: 'I/2.6 Regisztrációs központ',
          description: 'Regisztrációs feladatok',
        },
      ],
    },

    {
      name: 'I/3. Pénzügyi Igazgatóság',
      description: 'Pénzügyi ügyek kezelése',
      children: level > 1 && [
        {
          name: 'I/3.7 Bevételi központ',
          description: 'Bevételek kezelése',
        },
        {
          name: 'I/3.8 Kifizetési központ',
          description: 'Kifizetések kezelése',
        },
        {
          name: 'I/3.9 Nyilvántartások, vagyontárgyak',
          description: 'Vagyonkezelés',
        },
      ],
    },

    {
      name: 'I/4. Termelési Igazgatóság',
      description: 'Termelés irányítása',
      children: level > 1 && [
        {
          name: 'I/4.10 Tervezési központ',
          description: 'Tervezési feladatok',
        },
        {
          name: 'I/4.11 Terület kialakítás',
          description: 'Területfejlesztés',
        },
        {
          name: 'I/4.12 Termelés irányítása',
          description: 'Termelésirányítás',
          children: level > 2 && [
            {
              name: 'I/4.12.1 Mező- és erdőgazdálkodás',
              description: 'Mezőgazdasági és erdészeti tevékenység',
            },
          ],
        },
      ],
    },

    {
      name: 'I/5. Minőségfelügyeleti Igazgatóság',
      description: 'Minőség és ellenőrzés',
      children: level > 1 && [
        {
          name: 'I/5.13 Érvényesítés',
          description: 'Érvényesítési feladatok',
        },
        {
          name: 'I/5.14 Munkatárs fejlesztés',
          description: 'Személyzetfejlesztés',
        },
        {
          name: 'I/5.15 Korrekciós központ',
          description: 'Hibaelhárítás',
        },
      ],
    },

    {
      name: 'I/6. Terjesztési Igazgatóság',
      description: 'Terjesztés és logisztika',
      children: level > 1 && [
        {
          name: 'I/6.16 Kapcsolatfelvétel',
          description: 'Új kapcsolatok építése',
        },
        {
          name: 'I/6.17 Területi támogatás',
          description: 'Területi támogatás',
        },
        {
          name: 'I/6.18 Területek felügyelete',
          description: 'Területfelügyelet',
        },
      ],
    },
  ];

  return hierarchicalOrgs;
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
