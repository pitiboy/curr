'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SETTING_UID = 'api::setting.setting';

function parseSeedFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Settings seed must be a JSON array: ${filePath}`);
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || typeof entry.key !== 'string') {
      throw new Error(`Invalid seed row at index ${index} in ${filePath}`);
    }
    const key = entry.key.trim();
    if (!key) {
      throw new Error(`Empty key at index ${index} in ${filePath}`);
    }
    return {
      key,
      enabled: entry.enabled === true,
      config:
        entry.config != null &&
        typeof entry.config === 'object' &&
        !Array.isArray(entry.config)
          ? entry.config
          : null,
    };
  });
}

async function upsertBackofficeFeatureSeeds(strapi, entries) {
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

async function upsertBackofficeFeaturesFromFile(strapi, filePath) {
  const entries = parseSeedFile(path.resolve(filePath));
  await upsertBackofficeFeatureSeeds(strapi, entries);
}

function resolveBackofficeFeaturesSeedPath(instance) {
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

module.exports = {
  SETTING_UID,
  parseSeedFile,
  upsertBackofficeFeatureSeeds,
  upsertBackofficeFeaturesFromFile,
  resolveBackofficeFeaturesSeedPath,
};
