import fs from 'node:fs';
import path from 'node:path';

import { SETTING_UID } from './constants';

type SeedEntry = {
  key: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
};

type SettingDocument = { key?: string | null };

type SettingApi = {
  findMany: (params?: Record<string, unknown>) => Promise<SettingDocument[]>;
  create: (params: {
    data: {
      key: string;
      enabled: boolean;
      config: Record<string, unknown> | null;
    };
  }) => Promise<unknown>;
};

type SeedStrapi = {
  documents: (uid: string) => SettingApi;
  log: { info: (message: string) => void };
};

export function parseSeedFile(filePath: string): SeedEntry[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Settings seed must be a JSON array: ${filePath}`);
  }

  return parsed.map((entry, index) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof (entry as { key?: unknown }).key !== 'string'
    ) {
      throw new Error(`Invalid seed row at index ${index} in ${filePath}`);
    }
    const row = entry as {
      key: string;
      enabled?: unknown;
      config?: unknown;
    };
    const key = row.key.trim();
    if (!key) {
      throw new Error(`Empty key at index ${index} in ${filePath}`);
    }
    return {
      key,
      enabled: row.enabled === true,
      config:
        row.config != null &&
        typeof row.config === 'object' &&
        !Array.isArray(row.config)
          ? (row.config as Record<string, unknown>)
          : null,
    };
  });
}

export async function upsertBackofficeFeatureSeeds(
  strapi: SeedStrapi,
  entries: SeedEntry[],
) {
  const api = strapi.documents(SETTING_UID);
  const existing = await api.findMany({});
  const byKey = new Set(
    existing
      .map((row) => (typeof row.key === 'string' ? row.key.trim() : ''))
      .filter(Boolean),
  );

  for (const entry of entries) {
    if (byKey.has(entry.key)) {
      continue;
    }
    await api.create({
      data: {
        key: entry.key,
        enabled: entry.enabled === true,
        config: entry.config ?? null,
      },
    });
    byKey.add(entry.key);
    strapi.log.info(`Created setting "${entry.key}"`);
  }
}

export async function upsertBackofficeFeaturesFromFile(
  strapi: SeedStrapi,
  filePath: string,
) {
  const entries = parseSeedFile(path.resolve(filePath));
  await upsertBackofficeFeatureSeeds(strapi, entries);
}

export function resolveBackofficeFeaturesSeedPath(instance: string) {
  const normalized = String(instance).trim().toLowerCase();
  return path.join(
    process.cwd(),
    'database',
    'seeders',
    'http',
    normalized,
    'data',
    'backoffice-features.json',
  );
}
