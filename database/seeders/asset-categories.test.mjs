import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const INSTANCES = ['kor', 'edizone'];

function loadCategories(instance) {
  return JSON.parse(
    readFileSync(
      new URL(`./http/${instance}/data/asset-categories.json`, import.meta.url),
      'utf8',
    ),
  );
}

/** Mirrors 12-asset-categories.http: lookup by name, POST only when missing. */
function simulateSeed(items, store) {
  let created = 0;
  for (const item of items) {
    if (store.some((row) => row.name === item.name)) continue;
    store.push({ ...item });
    created += 1;
  }
  return created;
}

describe('asset-categories seeder data', () => {
  it('has non-empty, unique names in every instance', () => {
    for (const instance of INSTANCES) {
      const items = loadCategories(instance);
      assert.ok(items.length > 0, instance);
      const names = items.map((item) => item.name.trim().toLowerCase());
      assert.ok(
        names.every((name) => name.length > 0),
        instance,
      );
      assert.equal(new Set(names).size, names.length, instance);
    }
  });

  it('kor and edizone share the same starter list', () => {
    assert.deepEqual(loadCategories('kor'), loadCategories('edizone'));
  });

  it('is idempotent: a second run creates nothing', () => {
    const items = loadCategories('kor');
    const store = [];
    assert.equal(simulateSeed(items, store), items.length);
    assert.equal(simulateSeed(items, store), 0);
    assert.equal(store.length, items.length);
  });

  it('the http seeder looks up by name before it creates', () => {
    const http = readFileSync(
      new URL('./http/common/12-asset-categories.http', import.meta.url),
      'utf8',
    );
    const lookup = http.indexOf(
      'GET {{baseUrl}}/api/asset-categories?filters[name][$eq]',
    );
    const create = http.indexOf('POST {{baseUrl}}/api/asset-categories');
    assert.ok(lookup > 0 && create > lookup);
    assert.match(
      http,
      /if \(acIds\[item\.name\] \|\| acFailed\[item\.name\]\)/,
    );
  });
});

describe('asset purchase workflow seed', () => {
  it('debits 1500, collects the asset, and credits the payment side via 2000', () => {
    for (const instance of INSTANCES) {
      const wf = JSON.parse(
        readFileSync(
          new URL(
            `./http/${instance}/data/transaction-workflows/41-targyi-eszkoz-vasarlas.json`,
            import.meta.url,
          ),
          'utf8',
        ),
      );
      assert.equal(wf.name, 'Tárgyi eszköz vásárlás');
      assert.equal(wf.debit_account_code, '1500');
      assert.equal(wf.credit_account_code, '1100');
      assert.equal(wf.collect_asset, true);
      assert.equal(wf.steps[0].debit_code, '{original.debit_account_code}');
      assert.equal(wf.steps[0].credit_code, '2000');
      assert.equal(wf.steps[1].debit_code, '2000');
    }
  });

  it('the assets backoffice feature is enabled for kor and edizone', () => {
    for (const instance of INSTANCES) {
      const rows = JSON.parse(
        readFileSync(
          new URL(
            `./http/${instance}/data/backoffice-features.json`,
            import.meta.url,
          ),
          'utf8',
        ),
      );
      const row = rows.find((item) => item.key === 'assets');
      assert.ok(row, instance);
      assert.equal(row.enabled, true, instance);
    }
  });
});
