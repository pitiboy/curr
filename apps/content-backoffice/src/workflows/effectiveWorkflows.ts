export function parseWorkflowOverride(raw: string | null): string[] | null {
  if (raw === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => typeof item !== 'string')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Local override wins. A missing override follows the server list. */
export function effectiveWorkflows(
  enabled: readonly string[],
  available: readonly string[],
  override: readonly string[] | null,
): string[] {
  if (override === null) {
    return [...enabled];
  }

  const known = new Set(available);
  return override.filter(
    (id, index) => known.has(id) && override.indexOf(id) === index,
  );
}

export function visibleWorkflowForms<
  T extends { id: string; roles: readonly string[] },
>(forms: readonly T[], effective: readonly string[], role: string): T[] {
  const on = new Set(effective);
  return forms.filter((form) => on.has(form.id) && form.roles.includes(role));
}
