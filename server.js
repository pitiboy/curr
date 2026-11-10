'use strict';

const { startWithWakeListener } = require('./server/wake-entry.js');

startWithWakeListener({ distDir: './dist' }).catch((error) => {
  console.error(error);
  process.exit(1);
});
