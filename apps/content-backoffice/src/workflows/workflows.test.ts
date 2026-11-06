import { describe, expect, it } from 'vitest';

import { buildBackofficeConfigFromRows } from '../../../../src/api/backoffice/config';
import { workflowConfigFromKeys } from '../../../../src/api/backoffice/workflows';
import {
  eggProductionInitialPublicationStatus,
  parseBackofficeConfig,
} from './parseBackofficeConfig';
import { visibleWorkflowForms } from './effectiveWorkflows';
import { eggDailyEntryConfig } from './bulk-quantity/configs/eggDailyEntry.config';
import { EGG_PRODUCTION_WORKFLOW_ID } from './bulk-quantity/eggDailyEntry.constants';

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
        { key: 'egg-production', enabled: false, config: {} },
      ]),
    ).toMatchObject({
      publisherMustDiffer: false,
      enabled: ['member-fee'],
      available: ['member-fee', 'egg-production'],
    });
  });
});

describe('eggProductionInitialPublicationStatus', () => {
  it('defaults to draft and reads published from config regardless of workflow enabled', () => {
    expect(
      eggProductionInitialPublicationStatus(parseBackofficeConfig(null)),
    ).toBe('draft');
    expect(
      eggProductionInitialPublicationStatus(
        parseBackofficeConfig({
          enabled: [],
          available: [],
          publisherMustDiffer: true,
          debitCodesPattern: '/^5/',
          creditCodesPattern: '/^(1|3)/',
          appTitle: '',
          eggSaleCurrency: 'HUF',
          features: {
            'egg-production': {
              enabled: false,
              config: { initialPublicationStatus: 'published' },
            },
          },
        }),
      ),
    ).toBe('published');
    expect(
      eggProductionInitialPublicationStatus(
        parseBackofficeConfig({
          enabled: [EGG_PRODUCTION_WORKFLOW_ID],
          available: [EGG_PRODUCTION_WORKFLOW_ID],
          publisherMustDiffer: true,
          debitCodesPattern: '/^5/',
          creditCodesPattern: '/^(1|3)/',
          appTitle: '',
          eggSaleCurrency: 'HUF',
          features: {
            'egg-production': {
              enabled: true,
              config: { initialPublicationStatus: 'published' },
            },
          },
        }),
      ),
    ).toBe('published');
  });
});

describe('parseBackofficeConfig', () => {
  it('reads publisherMustDiffer and account patterns from the API body', () => {
    expect(parseBackofficeConfig(null).publisherMustDiffer).toBe(true);
    expect(parseBackofficeConfig(null).appTitle).toBe('');
    expect(
      parseBackofficeConfig({
        enabled: [EGG_PRODUCTION_WORKFLOW_ID],
        available: ['member-fee', EGG_PRODUCTION_WORKFLOW_ID],
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
        ['member-fee', EGG_PRODUCTION_WORKFLOW_ID],
        [EGG_PRODUCTION_WORKFLOW_ID, 'unknown'],
      ),
    ).toEqual({
      enabled: [EGG_PRODUCTION_WORKFLOW_ID],
      available: ['member-fee', EGG_PRODUCTION_WORKFLOW_ID],
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
    expect(
      visibleWorkflowForms(forms, [EGG_PRODUCTION_WORKFLOW_ID], 'dataentry'),
    ).toEqual([forms[0]]);
    expect(visibleWorkflowForms(forms, [], 'dataentry')).toEqual([]);
    expect(
      visibleWorkflowForms(forms, [EGG_PRODUCTION_WORKFLOW_ID], 'editor'),
    ).toEqual([forms[0]]);
  });

  it('uses egg-production as the shared feature flag id', () => {
    expect(eggDailyEntryConfig.workflowId).toBe('egg-production');
  });
});
