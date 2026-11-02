import {
  BACKOFFICE_SETTING_KEYS,
  BACKOFFICE_SETTING_PREFIXES,
  DEFAULT_APP_TITLE,
  DEFAULT_CREDIT_CODES_PATTERN,
  DEFAULT_DEBIT_CODES_PATTERN,
  DEFAULT_EGG_SALE_CURRENCY,
} from './constants.ts';
import type {
  BackofficeConfigResponse,
  BackofficeFeatureRow,
  BackofficeFeatureState,
} from './types.ts';
import { DEFAULT_PUBLISH_POLICY, type PublishPolicy } from '../publish-guard.ts';

export function isBackofficeSettingKey(key: string): boolean {
  return BACKOFFICE_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function configObject(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function configString(
  config: Record<string, unknown> | null,
  field: string,
): string | undefined {
  const value = config?.[field];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function rowByKey(
  rows: readonly BackofficeFeatureRow[],
): Map<string, BackofficeFeatureRow> {
  return new Map(rows.map((row) => [row.key, row]));
}

export function publishPolicyFromFeatures(
  rows: readonly BackofficeFeatureRow[],
): PublishPolicy {
  if (rows.length === 0) {
    return DEFAULT_PUBLISH_POLICY;
  }

  const map = rowByKey(rows);
  const statusRow = map.get(BACKOFFICE_SETTING_KEYS.defaultStatus);
  const differRow = map.get(BACKOFFICE_SETTING_KEYS.publisherMustDiffer);

  const statusRaw = configString(statusRow?.config ?? null, 'value');
  const defaultStatus =
    statusRaw?.toLowerCase() === 'published' ? 'published' : 'draft';

  const publisherMustDiffer =
    differRow == null
      ? DEFAULT_PUBLISH_POLICY.publisherMustDiffer
      : differRow.enabled;

  return { defaultStatus, publisherMustDiffer };
}

export function buildBackofficeConfigFromFeatures(
  rows: readonly BackofficeFeatureRow[],
): BackofficeConfigResponse {
  const policy = publishPolicyFromFeatures(rows);
  const map = rowByKey(rows);

  const debitRow = map.get(BACKOFFICE_SETTING_KEYS.debitCodes);
  const creditRow = map.get(BACKOFFICE_SETTING_KEYS.creditCodes);
  const titleRow = map.get(BACKOFFICE_SETTING_KEYS.appTitle);
  const eggRow = map.get(BACKOFFICE_SETTING_KEYS.eggSaleCurrency);

  const debitCodesPattern =
    configString(debitRow?.config ?? null, 'pattern') ??
    DEFAULT_DEBIT_CODES_PATTERN;
  const creditCodesPattern =
    configString(creditRow?.config ?? null, 'pattern') ??
    DEFAULT_CREDIT_CODES_PATTERN;
  const appTitle =
    configString(titleRow?.config ?? null, 'value') ?? DEFAULT_APP_TITLE;
  const eggSaleCurrency =
    configString(eggRow?.config ?? null, 'value') ?? DEFAULT_EGG_SALE_CURRENCY;

  const workflowRows = rows.filter((row) => !isBackofficeSettingKey(row.key));
  const available = workflowRows.map((row) => row.key);
  const enabled = workflowRows
    .filter((row) => row.enabled)
    .map((row) => row.key);

  const features: Record<string, BackofficeFeatureState> = {};
  for (const row of rows) {
    features[row.key] = {
      enabled: row.enabled,
      config: row.config,
    };
  }

  return {
    enabled,
    available,
    publisherMustDiffer: policy.publisherMustDiffer,
    debitCodesPattern,
    creditCodesPattern,
    appTitle,
    eggSaleCurrency,
    features,
  };
}

export function emptyBackofficeConfig(): BackofficeConfigResponse {
  return buildBackofficeConfigFromFeatures([]);
}
