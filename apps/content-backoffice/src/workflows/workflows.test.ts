import { describe, expect, it } from 'vitest';

import { buildBackofficeConfigFromRows } from '../../../../src/api/backoffice/config';
import { workflowConfigFromKeys } from '../../../../src/api/backoffice/workflows';
import { parseBackofficeConfig } from './parseBackofficeConfig';
import { visibleWorkflowForms } from './effectiveWorkflows';
import { eggDailyEntryConfig } from './bulk-quantity/configs/eggDailyEntry.config';

describe('buildBackofficeConfigFromRows', () => {
  it('maps database rows to the config payload', () => {
    expect(
      buildBackofficeConfigFromRows([
        {
          key: 'content.publisher_must_differ',
          enabled: false,
          config: null,
        },
        { key: 'member-fee', enabled: true, config: {} },
        { key: 'egg-daily-entry', enabled: false, config: {} },
      ]),
    ).toMatchObject({
      publisherMustDiffer: false,
      enabled: ['member-fee'],
      available: ['member-fee', 'egg-daily-entry'],
    });
  });
});

describe('parseBackofficeConfig', () => {
  it('reads publisherMustDiffer and account patterns from the API body', () => {
    expect(parseBackofficeConfig(null).publisherMustDiffer).toBe(true);
    expect(parseBackofficeConfig(null).appTitle).toBe('');
    expect(
      parseBackofficeConfig({
        enabled: ['egg-daily-entry'],
        available: ['member-fee', 'egg-daily-entry'],
        publisherMustDiffer: false,
        debitCodesPattern: '/^6/',
        creditCodesPattern: '/^2/',
        appTitle: 'KÖR',
        eggSaleCurrency: 'EUR',
        features: {},
      }),
    ).toMatchObject({
      publisherMustDiffer: false,
      debitCodesPattern: '/^6/',
      appTitle: 'KÖR',
      eggSaleCurrency: 'EUR',
    });
  });
});

describe('workflowConfigFromKeys', () => {
  it('filters enabled ids to the available workflow list', () => {
    expect(
      workflowConfigFromKeys(
        ['member-fee', 'egg-daily-entry'],
        ['egg-daily-entry', 'unknown'],
      ),
    ).toEqual({
      enabled: ['egg-daily-entry'],
      available: ['member-fee', 'egg-daily-entry'],
    });
  });
});

describe('visibleWorkflowForms', () => {
  const forms = [
    {
      id: eggDailyEntryConfig.workflowId,
      roles: eggDailyEntryConfig.roles,
    },
  ];

  it('shows the intersection of the enabled list, the registry, and the role', () => {
    expect(visibleWorkflowForms(forms, ['egg-daily-entry'], 'dataentry')).toEqual([
      forms[0],
    ]);
    expect(visibleWorkflowForms(forms, [], 'dataentry')).toEqual([]);
    expect(visibleWorkflowForms(forms, ['egg-daily-entry'], 'editor')).toEqual([
      forms[0],
    ]);
  });
});
