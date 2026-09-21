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
    // 1000s: Assets
    {
      name: 'Készpénz',
      code: '1000',
      category: categoryMap.asset,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },
    {
      name: 'Bankszámlák',
      code: '1100',
      category: categoryMap.asset,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },
    {
      name: 'Követelések',
      code: '1200',
      category: categoryMap.asset,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },
    {
      name: 'Készletek',
      code: '1300',
      category: categoryMap.asset,
      childOrganizationToLink: 'I/4. Termelési Igazgatóság',
    },
    {
      name: 'Előlegek',
      code: '1400',
      category: categoryMap.asset,
      childOrganizationToLink: 'I/6. Terjesztési Igazgatóság',
    },
    {
      name: 'Tárgyi eszközök',
      code: '1500',
      category: categoryMap.asset,
      childOrganizationToLink: 'I/4. Termelési Igazgatóság',
    },
    {
      name: 'Immateriális javak',
      code: '1600',
      category: categoryMap.asset,
      childOrganizationToLink: 'I/4. Termelési Igazgatóság',
    },
    {
      name: 'Pénzügyi befektetések',
      code: '1700',
      category: categoryMap.asset,
      childOrganizationToLink: 'I/4. Termelési Igazgatóság',
    },

    // 2000s: Liabilities
    {
      name: 'Szállítói tartozások',
      code: '2000',
      category: categoryMap.liability,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },
    {
      name: 'Rövid lejáratú kötelezettségek',
      code: '2100',
      category: categoryMap.liability,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },
    {
      name: 'Hosszú lejáratú kötelezettségek',
      code: '2200',
      category: categoryMap.liability,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },
    {
      name: 'Adótartozások',
      code: '2300',
      category: categoryMap.liability,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },
    {
      name: 'Bértartozások',
      code: '2400',
      category: categoryMap.liability,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },
    {
      name: 'Egyéb tartozások',
      code: '2500',
      category: categoryMap.liability,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },

    // 3000s: Equity
    {
      name: 'Alaptőke',
      code: '3000',
      category: categoryMap.equity,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },
    {
      name: 'Tartalékok',
      code: '3100',
      category: categoryMap.equity,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },
    {
      name: 'Eredménytartalék',
      code: '3200',
      category: categoryMap.equity,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },
    {
      name: 'Tárgyévi eredmény',
      code: '3300',
      category: categoryMap.equity,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },

    // 4000s: Revenue
    {
      name: 'Értékesítés bevétele',
      code: '4000',
      category: categoryMap.revenue,
      childOrganizationToLink: 'I/2. Marketing Igazgatóság',
    },
    {
      name: 'Szolgáltatás bevétele',
      code: '4100',
      category: categoryMap.revenue,
      childOrganizationToLink: 'I/2. Marketing Igazgatóság',
    },
    {
      name: 'Egyéb bevételek',
      code: '4200',
      category: categoryMap.revenue,
      childOrganizationToLink: 'I/3.7 Bevételi központ',
    },
    {
      name: 'Pénzügyi bevételek',
      code: '4300',
      category: categoryMap.revenue,
      childOrganizationToLink: 'I/3.7 Bevételi központ',
    },
    {
      name: 'Előfizetések és tagsági díjak',
      code: '4300',
      category: categoryMap.equity,
      childOrganizationToLink: 'I/3.7 Bevételi központ',
    },

    // 5000s: Expenses
    {
      name: 'Anyagköltség',
      code: '5000',
      category: categoryMap.expense,
      childOrganizationToLink: 'I/4. Termelési Igazgatóság',
    },
    {
      name: 'Bérköltség',
      code: '5100',
      category: categoryMap.expense,
      childOrganizationToLink: 'I/1.1 Irányítás és személyzeti központ',
    },
    {
      name: 'Társadalombiztosítási költség',
      code: '5200',
      category: categoryMap.expense,
      childOrganizationToLink: 'I/1.1 Irányítás és személyzeti központ',
    },
    {
      name: 'Értékcsökkenés',
      code: '5300',
      category: categoryMap.expense,
      childOrganizationToLink: 'I/5. Minőségfelügyeleti Igazgatóság',
    },
    {
      name: 'Szolgáltatások',
      code: '5400',
      category: categoryMap.expense,
      childOrganizationToLink: 'I/1. Kommunikációs Igazgatóság',
    },
    {
      name: 'Általános költségek',
      code: '5500',
      category: categoryMap.expense,
      childOrganizationToLink: 'I/0. Vezetés',
    },
    {
      name: 'Értékesítési költségek',
      code: '5600',
      category: categoryMap.expense,
      childOrganizationToLink: 'I/2. Marketing Igazgatóság',
    },
    {
      name: 'Pénzügyi költségek',
      code: '5700',
      category: categoryMap.expense,
      childOrganizationToLink: 'I/3. Pénzügyi Igazgatóság',
    },
    {
      name: 'Egyéb költségek',
      code: '5800',
      category: categoryMap.expense,
      childOrganizationToLink: 'I/0. Vezetés',
    },
  ];

  // Create accounts with hardcoded organization mapping
  for (const account of accounts) {
    const mappedOrgId = await findOrganizationByName(
      strapi,
      account.childOrganizationToLink,
      organizationId
    );

    await strapi.entityService.create('api::account.account', {
      data: {
        name: account.name,
        code: account.code,
        category: account.category,
        organization: mappedOrgId,
        description: `${account.name} számla`,
      },
    });
  }

  console.log(
    `✅ Created ${accounts.length} accounts with hardcoded organization mapping`
  );
}

async function findOrganizationByName(strapi, targetOrgName, defaultOrgId) {
  if (!targetOrgName) {
    return defaultOrgId;
  }

  // Find the organization by name
  const organizations = await strapi.entityService.findMany(
    'api::organization.organization',
    {
      filters: { name: targetOrgName },
      limit: 1,
    }
  );

  if (organizations.length > 0) {
    return organizations[0].id;
  } else {
    console.log(`⚠️  Organization "${targetOrgName}" not found, using default`);
    return defaultOrgId;
  }
}
