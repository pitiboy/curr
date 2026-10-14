export type BackofficeConfigResponse = {
  enabled: string[];
  available: string[];
};

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export function parseBackofficeConfig(body: unknown): BackofficeConfigResponse {
  if (!body || typeof body !== 'object') {
    return { enabled: [], available: [] };
  }

  const record = body as Record<string, unknown>;
  const available = stringList(record.available);
  const known = new Set(available);
  return {
    enabled: stringList(record.enabled).filter((id) => known.has(id)),
    available,
  };
}
