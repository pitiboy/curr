import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isEditableLayoutAttribute,
  isListableLayoutAttribute,
  sanitizeConfigurationLayouts,
  type LayoutSchema,
} from './content-manager-config-sanitize.ts';

const currencyRateSchema: LayoutSchema = {
  uid: 'api::currency-rate.currency-rate',
  attributes: {
    rate: { type: 'decimal' },
    valid_from: { type: 'datetime' },
    from_currency_type: { type: 'relation', relation: 'manyToOne' },
    to_currency_type: { type: 'relation', relation: 'manyToOne' },
    createdAt: { type: 'datetime' },
    updatedAt: { type: 'datetime' },
    createdBy: { type: 'relation', relation: 'oneToOne' },
    updatedBy: { type: 'relation', relation: 'oneToOne' },
  },
};

const transactionSchema: LayoutSchema = {
  uid: 'api::transaction.transaction',
  attributes: {
    date: { type: 'date' },
    amount: { type: 'decimal' },
    description: { type: 'text' },
    createdAt: { type: 'datetime' },
    updatedAt: { type: 'datetime' },
    createdBy: { type: 'relation', relation: 'oneToOne' },
    updatedBy: { type: 'relation', relation: 'oneToOne' },
    publishedAt: { type: 'datetime' },
  },
};

describe('isEditableLayoutAttribute', () => {
  it('allows schema fields and rejects system fields', () => {
    assert.equal(isEditableLayoutAttribute(currencyRateSchema, 'rate'), true);
    assert.equal(
      isEditableLayoutAttribute(currencyRateSchema, 'from_currency_type'),
      true,
    );
    assert.equal(
      isEditableLayoutAttribute(currencyRateSchema, 'createdAt'),
      false,
    );
    assert.equal(
      isEditableLayoutAttribute(currencyRateSchema, 'updatedAt'),
      false,
    );
    assert.equal(
      isEditableLayoutAttribute(currencyRateSchema, 'createdBy'),
      false,
    );
    assert.equal(
      isEditableLayoutAttribute(currencyRateSchema, 'updatedBy'),
      false,
    );
    assert.equal(
      isEditableLayoutAttribute(transactionSchema, 'publishedAt'),
      false,
    );
    assert.equal(
      isEditableLayoutAttribute(currencyRateSchema, 'valid_to'),
      false,
    );
  });
});

describe('isListableLayoutAttribute', () => {
  it('allows timestamps in list but not unknown or non-listable types', () => {
    assert.equal(isListableLayoutAttribute(currencyRateSchema, 'rate'), true);
    assert.equal(
      isListableLayoutAttribute(currencyRateSchema, 'createdAt'),
      true,
    );
    assert.equal(
      isListableLayoutAttribute(currencyRateSchema, 'valid_to'),
      false,
    );
    assert.equal(
      isListableLayoutAttribute(
        {
          attributes: {
            payload: { type: 'json' },
          },
        },
        'payload',
      ),
      false,
    );
  });
});

describe('sanitizeConfigurationLayouts', () => {
  it('drops system and removed fields from edit, keeps real ones', () => {
    const { body, stripped } = sanitizeConfigurationLayouts(
      {
        layouts: {
          edit: [
            [{ name: 'rate', size: 6 }],
            [{ name: 'valid_from', size: 6 }],
            [{ name: 'from_currency_type', size: 6 }],
            [{ name: 'to_currency_type', size: 6 }],
            [{ name: 'createdAt', size: 6 }],
            [{ name: 'updatedAt', size: 6 }],
            [{ name: 'createdBy', size: 6 }],
            [{ name: 'updatedBy', size: 6 }],
            [{ name: 'valid_to', size: 6 }],
          ],
        },
      },
      currencyRateSchema,
    );

    assert.deepEqual(body.layouts?.edit, [
      [{ name: 'rate', size: 6 }],
      [{ name: 'valid_from', size: 6 }],
      [{ name: 'from_currency_type', size: 6 }],
      [{ name: 'to_currency_type', size: 6 }],
    ]);
    assert.deepEqual(
      [...stripped].sort(),
      [
        'createdAt',
        'createdBy',
        'updatedAt',
        'updatedBy',
        'valid_to',
      ].sort(),
    );
  });

  it('removes empty edit rows after filtering', () => {
    const { body } = sanitizeConfigurationLayouts(
      {
        layouts: {
          edit: [
            [{ name: 'date', size: 6 }, { name: 'createdAt', size: 6 }],
            [{ name: 'publishedAt', size: 6 }],
            [{ name: 'amount', size: 6 }],
          ],
        },
      },
      transactionSchema,
    );

    assert.deepEqual(body.layouts?.edit, [
      [{ name: 'date', size: 6 }],
      [{ name: 'amount', size: 6 }],
    ]);
  });

  it('filters list layouts to listable names only', () => {
    const { body, stripped } = sanitizeConfigurationLayouts(
      {
        layouts: {
          list: ['rate', 'createdAt', 'valid_to', 'payload'],
        },
      },
      currencyRateSchema,
    );

    assert.deepEqual(body.layouts?.list, ['rate', 'createdAt']);
    assert.deepEqual([...stripped].sort(), ['payload', 'valid_to'].sort());
  });

  it('leaves body unchanged when layouts are missing', () => {
    const input = { settings: { pageSize: 10 } };
    const { body, stripped } = sanitizeConfigurationLayouts(
      input,
      currencyRateSchema,
    );
    assert.equal(body, input);
    assert.deepEqual(stripped, []);
  });
});
