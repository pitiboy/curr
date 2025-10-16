export default {
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
    // Import and run the bootstrap seeding
    const path = require('path');
    const fs = require('fs');

    // Try different possible paths
    const possiblePaths = [
      path.resolve(__dirname, '../../database/seeders/initial-data.js'),
      path.resolve(process.cwd(), 'database/seeders/initial-data.js'),
      path.resolve(__dirname, '../../../database/seeders/initial-data.js'),
    ];

    let seederPath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        seederPath = testPath;
        break;
      }
    }

    if (!seederPath) {
      console.log('🌱 Seeder file not found, skipping bootstrap seeding');
      return;
    }

    const seeder = require(seederPath);
    await seeder.bootstrap({ strapi });
  },
};
