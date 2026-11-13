import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildBackofficeConfigFromFeatures,
  emptyBackofficeConfig,
  isBackofficeSettingKey,
  publishPolicyFromFeatures,
  rolesFromFeatureConfig,
} from './parse.ts';

describe('rolesFromFeatureConfig', () => {
  it('reads trimmed string roles and ignores junk', () => {
    assert.deepEqual(
      rolesFromFeatureConfig({ roles: ['controller', '  editor ', 1, ''] }),
      ['controller', 'editor'],
    );
    assert.deepEqual(rolesFromFeatureConfig({}), []);
    assert.deepEqual(rolesFromFeatureConfig(null), []);
  });
});

describe('isBackofficeSettingKey', () => {
  it('treats dotted content and accounts keys as settings', () => {
    assert.equal(isBackofficeSettingKey('content.default_status'), true);
    assert.equal(isBackofficeSettingKey('egg-production'), false);
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
      appTitle: '',
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
      {
        key: 'app.title',
        enabled: true,
        config: { value: 'KÖR' },
      },
      { key: 'member-fee', enabled: false, config: {} },
      {
        key: 'egg-production',
        enabled: true,
        config: { saleCurrency: 'EUR' },
      },
    ]);

    assert.deepEqual(config.enabled, ['egg-production']);
    assert.deepEqual(config.available, ['member-fee', 'egg-production']);
    assert.equal(config.publisherMustDiffer, false);
    assert.equal(config.debitCodesPattern, '/^6/');
    assert.equal(config.appTitle, 'KÖR');
    assert.equal(config.features['egg-production']?.enabled, true);
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
