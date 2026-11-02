/**
 * Preload for `npm test`: resolve extensionless relative imports to `.ts`
 * so `node --experimental-strip-types` can load modules that Strapi compiles
 * with extensionless paths (`.ts` suffixes in source break the CJS emit).
 */
import { register } from 'node:module';

register('./ts-extless-resolve-hook.mjs', import.meta.url);
