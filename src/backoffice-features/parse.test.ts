import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildBackofficeConfigFromFeatures,
  emptyBackofficeConfig,
  isBackofficeSettingKey,
  publishPolicyFromFeatures,
} from './parse';

describe('isBackofficeSettingKey', () => {
  it('treats dotted content and accounts keys as settings', () => {
    assert.equal(isBackofficeSettingKey('content.default_status'), true);
    assert.equal(isBackofficeSettingKey('egg-daily-entry'), false);
  });
});

describe('buildBackofficeConfigFromFeatures', () => {
  it('defaults when no rows exist', () => {
    assert.deepEqual(emptyBackofficeConfig(), {
      enabled: [],
      available: [],
      publisherMustDiffer: true,
      debitCodesPattern: '/^5/',
      creditCodesPattern: '/^(1|3)/',
      eggSaleCurrency: 'HUF',
      features: {},
    });
  });

  it('enables workflow rows and reads settings from config json', () => {
    const config = buildBackofficeConfigFromFeatures([
      {
        key: 'content.publisher_must_differ',
        enabled: false,
        config: null,
      },
      {
        key: 'accounts.debit_codes',
        enabled: true,
        config: { pattern: '/^6/' },
      },
      { key: 'member-fee', enabled: false, config: {} },
      { key: 'egg-daily-entry', enabled: true, config: { saleCurrency: 'EUR' } },
    ]);

    assert.deepEqual(config.enabled, ['egg-daily-entry']);
    assert.deepEqual(config.available, ['member-fee', 'egg-daily-entry']);
    assert.equal(config.publisherMustDiffer, false);
    assert.equal(config.debitCodesPattern, '/^6/');
    assert.equal(config.features['egg-daily-entry']?.enabled, true);
  });
});

describe('publishPolicyFromFeatures', () => {
  it('reads default status from config value', () => {
    assert.deepEqual(
      publishPolicyFromFeatures([
        {
          key: 'content.default_status',
          enabled: true,
          config: { value: 'published' },
        },
      ]),
      { defaultStatus: 'published', publisherMustDiffer: true },
    );
  });
});
