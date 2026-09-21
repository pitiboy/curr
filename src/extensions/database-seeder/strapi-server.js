module.exports = (plugin) => {
  // Add a custom route for seeding
  plugin.routes['content-api'].routes.push({
    method: 'POST',
    path: '/seed/initial-data',
    handler: 'database-seeder.seedInitialData',
    config: {
      policies: [],
      middlewares: [],
    },
  });

  // Add the controller
  plugin.controllers['database-seeder'] = {
    async seedInitialData(ctx) {
      try {
        console.log('🌱 Manual seeding triggered from admin panel...');

        // Import and run the seeder
        const seeder = require('../../../database/seeders/initial-data.js');
        await seeder.bootstrap({ strapi });

        ctx.body = {
          success: true,
          message: 'Initial data seeded successfully!',
        };
      } catch (error) {
        console.error('❌ Seeding failed:', error);
        ctx.status = 500;
        ctx.body = {
          success: false,
          message: 'Seeding failed: ' + error.message,
        };
      }
    },
  };

  return plugin;
};
