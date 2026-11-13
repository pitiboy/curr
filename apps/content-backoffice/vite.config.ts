import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

function resolveBuildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: packageRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    return String(Date.now());
  }
}

function emitVersionJson(buildId: string): Plugin {
  return {
    name: 'emit-backoffice-version-json',
    closeBundle() {
      const outDir = path.join(packageRoot, 'dist');
      writeFileSync(
        path.join(outDir, 'version.json'),
        `${JSON.stringify({ buildId })}\n`,
        'utf8',
      );
    },
  };
}

export default defineConfig(() => {
  const buildId = resolveBuildId();

  return {
    plugins: [react(), emitVersionJson(buildId)],
    base: '/backoffice/',
    define: {
      'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
    },
    resolve: {
      dedupe: ['react', 'react-dom', 'react-admin', 'ra-core'],
    },
  };
});
