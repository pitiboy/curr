'use strict';

const http = require('node:http');
const path = require('node:path');

function loadWakeHandlers() {
  const compiled = path.join(
    __dirname,
    '..',
    'dist',
    'src',
    'wake',
    'http-handlers.js',
  );
  try {
    return require(compiled);
  } catch (error) {
    console.error(
      'wake-entry: missing compiled wake handlers at',
      compiled,
      '- run npm run compile:server before starting production server.js',
    );
    throw error;
  }
}

/**
 * Production entry: bind HTTP immediately, answer /api/wake before Strapi load(),
 * then forward other requests to the Koa app without calling strapi.listen() (avoids
 * double bind on Passenger/cPanel PORT).
 */
async function startWithWakeListener(options) {
  const { createStrapi } = require('@strapi/strapi');
  const wake = loadWakeHandlers();

  const readyState = { ready: false, bootstrapFailed: false };
  let strapiHandler = null;
  let strapiInstance = null;

  const server = http.createServer((req, res) => {
    const handled = wake.handleEarlyRequest(
      req,
      res,
      readyState,
      strapiHandler,
    );
    if (!handled && strapiHandler) {
      strapiHandler(req, res);
    }
  });

  const host = process.env.HOST || '0.0.0.0';
  const port = Number.parseInt(process.env.PORT || '1337', 10);

  await new Promise((resolve, reject) => {
    server.listen(port, host, (err) => (err ? reject(err) : resolve()));
  });

  const strapi = await createStrapi({
    distDir: options.distDir || './dist',
    autoReload: false,
  });

  try {
    await strapi.load();
    strapi.server.mount();
    strapiHandler = strapi.server.app.callback();
    strapiInstance = strapi;
    readyState.ready = true;
    if (typeof strapi.postListen === 'function') {
      await strapi.postListen();
    }
  } catch (error) {
    readyState.bootstrapFailed = true;
    console.error(error);
    throw error;
  }

  const shutdown = async (signal) => {
    try {
      if (strapiInstance) {
        await strapiInstance.destroy();
      }
    } finally {
      await new Promise((resolve) => server.close(() => resolve()));
      if (signal) {
        process.exit(0);
      }
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return { server, strapi: strapiInstance };
}

module.exports = { startWithWakeListener };
