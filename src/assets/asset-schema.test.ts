import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  ASSET_OWNERSHIP_TYPES,
  ASSET_STATUSES,
  DEFAULT_ASSET_OWNERSHIP_TYPE,
  DEFAULT_ASSET_STATUS,
} from './constants.ts';

type Attribute = Record<string, unknown>;

function schema(name: string): { attributes: Record<string, Attribute> } {
  return JSON.parse(
    readFileSync(
      new URL(
        `../api/${name}/content-types/${name}/schema.json`,
        import.meta.url,
      ),
      'utf8',
    ),
  );
}

describe('asset schema', () => {
  const { attributes } = schema('asset');

  it('ownership_type enum and default match the constants', () => {
    assert.equal(attributes.ownership_type.type, 'enumeration');
    assert.deepEqual(attributes.ownership_type.enum, [
      ...ASSET_OWNERSHIP_TYPES,
    ]);
    assert.equal(
      attributes.ownership_type.default,
      DEFAULT_ASSET_OWNERSHIP_TYPE,
    );
    assert.equal(attributes.ownership_type.default, 'coop_owned');
  });

  it('status enum and default match the constants', () => {
    assert.equal(attributes.status.type, 'enumeration');
    assert.deepEqual(attributes.status.enum, [...ASSET_STATUSES]);
    assert.equal(attributes.status.default, DEFAULT_ASSET_STATUS);
    assert.ok((attributes.status.enum as string[]).includes('disposed'));
  });

  it('requires name and organization; relations point at the right targets', () => {
    assert.equal(attributes.name.required, true);
    assert.equal(attributes.organization.required, true);
    const relations: Record<string, string> = {
      category: 'api::asset-category.asset-category',
      currency_type: 'api::currency-type.currency-type',
      responsible_member: 'api::member.member',
      organization: 'api::organization.organization',
      acquisition_transaction: 'api::transaction.transaction',
      disposal_transaction: 'api::transaction.transaction',
    };
    for (const [field, target] of Object.entries(relations)) {
      assert.equal(attributes[field].type, 'relation', field);
      assert.equal(attributes[field].relation, 'manyToOne', field);
      assert.equal(attributes[field].target, target, field);
    }
  });

  it('photo is a single optional image', () => {
    assert.equal(attributes.photo.type, 'media');
    assert.equal(attributes.photo.multiple, false);
    assert.deepEqual(attributes.photo.allowedTypes, ['images']);
  });
});

describe('asset-category schema', () => {
  it('name is required and unique; sort_order is optional', () => {
    const { attributes } = schema('asset-category');
    assert.equal(attributes.name.required, true);
    assert.equal(attributes.name.unique, true);
    assert.notEqual(attributes.sort_order.required, true);
  });
});

describe('transaction-workflow schema', () => {
  it('has an optional collect_asset flag defaulting to false', () => {
    const { attributes } = schema('transaction-workflow');
    assert.equal(attributes.collect_asset.type, 'boolean');
    assert.equal(attributes.collect_asset.default, false);
  });
});
