/** `config.roles` from a Settings / feature row; empty when missing or invalid. */
export function featureRolesFromConfig(
  config: Record<string, unknown> | null | undefined,
): string[] {
  const raw = config?.roles;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
