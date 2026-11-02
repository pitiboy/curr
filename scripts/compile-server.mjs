#!/usr/bin/env node
/**
 * Emit dist/src for production.
 *
 * `strapi build` compiles with the project tsconfig as-is. That file keeps
 * `"noEmit": true` (IDE / `tsc --noEmit`). Strapi only forces `noEmit: false`
 * when `ignoreDiagnostics: true` (develop watch) — so CI `strapi build` builds
 * admin into dist/build and never writes dist/src. Passenger then keeps the
 * stale server schemas on the host.
 */
import fs from 'node:fs';
import path from 'node:path';
import tsUtils from '@strapi/typescript-utils';

const cwd = process.cwd();
const apiDir = path.join(cwd, 'dist', 'src', 'api');

await tsUtils.compile(cwd, {
  configOptions: {
    // develop watch uses ignoreDiagnostics:true to flip noEmit; we must emit
    // for Passenger. allowImportingTsExtensions is IDE-only and illegal with emit.
    ignoreDiagnostics: false,
    options: {
      noEmit: false,
      noEmitOnError: true,
      allowImportingTsExtensions: false,
    },
  },
});

if (!fs.existsSync(apiDir)) {
  console.error('compile-server: dist/src/api missing after TypeScript emit');
  process.exit(1);
}

console.log('compile-server: emitted dist/src');
