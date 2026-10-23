/** Known workflow ids, in menu order. Env tokens outside this list stay hidden. */
export const KNOWN_BACKOFFICE_WORKFLOWS = [
  'member-fee',
  'egg-daily-entry',
] as const;

export type BackofficeWorkflowConfig = {
  enabled: string[];
  available: string[];
};

/**
 * Env tokens that are in the known list, in known-list order.
 * Unknown and blank tokens are dropped.
 */
export function selectWorkflows(
  raw: string | undefined | null,
  known: readonly string[] = KNOWN_BACKOFFICE_WORKFLOWS,
): BackofficeWorkflowConfig {
  const requested = new Set(
    (raw ?? '')
      .split(',')
      .map((token) => token.trim())
      .filter((token) => token.length > 0),
  );

  return {
    enabled: known.filter((id) => requested.has(id)),
    available: [...known],
  };
}
