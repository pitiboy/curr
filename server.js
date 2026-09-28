'use strict';
async function main() {
  const { createStrapi } = require('@strapi/strapi');
  const app = await createStrapi({
    distDir: './dist',
    autoReload: false,
  });
  await app.start();
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});