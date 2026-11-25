import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { ensureAssetCategories } from './asset-categories.ts';
import { ASSET_CATEGORY_SEED } from './constants.ts';

function fakeStore(initial: Array<{ name: string }> = []) {
  const rows = [...initial];
  const created: string[] = [];
  return {
    rows,
    created,
    strapi: {
      documents: () => ({
        findMany: async () => rows.map((row) => ({ ...row })),
        create: async ({ data }: { data: { name: string } }) => {
          rows.push({ name: data.name });
          created.push(data.name);
        },
      }),
      log: { info() {} },
    },
  };
}

describe('ensureAssetCategories', () => {
  it('creates every starter category on an empty database', async () => {
    const store = fakeStore();
    await ensureAssetCategories(store.strapi);
    assert.deepEqual(
      store.created,
      ASSET_CATEGORY_SEED.map((item) => item.name),
    );
  });

  it('is idempotent: a second run creates nothing', async () => {
    const store = fakeStore();
    await ensureAssetCategories(store.strapi);
    const firstRun = store.rows.length;
    const createdAgain = await ensureAssetCategories(store.strapi);
    assert.deepEqual(createdAgain, []);
    assert.equal(store.rows.length, firstRun);
  });

  it('skips names that already exist (trimmed, case-insensitive)', async () => {
    const store = fakeStore([
      { name: '  mezőgazdasági GÉPEK ' },
      { name: 'Saját kategória' },
    ]);
    await ensureAssetCategories(store.strapi);
    assert.equal(store.created.includes('Mezőgazdasági gépek'), false);
    assert.equal(store.created.length, ASSET_CATEGORY_SEED.length - 1);
  });
});

describe('asset category seed data', () => {
  it('matches the httpyac seeder JSON for both instances', () => {
    for (const instance of ['kor', 'edizone']) {
      const json = JSON.parse(
        readFileSync(
          new URL(
            `../../database/seeders/http/${instance}/data/asset-categories.json`,
            import.meta.url,
          ),
          'utf8',
        ),
      ) as Array<{ name: string; sort_order?: number }>;
      assert.deepEqual(
        json.map((row) => ({ name: row.name, sort_order: row.sort_order })),
        ASSET_CATEGORY_SEED.map((row) => ({ ...row })),
        instance,
      );
    }
  });

  it('has unique names', () => {
    const names = ASSET_CATEGORY_SEED.map((row) =>
      row.name.toLocaleLowerCase('hu'),
    );
    assert.equal(new Set(names).size, names.length);
  });
});
