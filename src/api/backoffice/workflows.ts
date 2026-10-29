import { isBackofficeSettingKey } from '../../backoffice-features/parse';

export type BackofficeWorkflowConfig = {
  enabled: string[];
  available: string[];
};

/** @deprecated Catalog is database-driven; kept for tests that assert menu order of seeded ids. */
export const LEGACY_WORKFLOW_MENU_ORDER = [
  'member-fee',
  'egg-daily-entry',
] as const;

/**
 * Builds workflow lists from feature rows (non-setting keys).
 * Order follows row order (typically sorted by key from the loader).
 */
export function workflowConfigFromKeys(
  keys: readonly string[],
  enabledKeys: readonly string[],
): BackofficeWorkflowConfig {
  const enabledSet = new Set(enabledKeys);
  const available = keys.filter((key) => !isBackofficeSettingKey(key));
  return {
    available,
    enabled: available.filter((id) => enabledSet.has(id)),
  };
}
