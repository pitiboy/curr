export type BackofficeConfigResponse = {
  enabled: string[];
  available: string[];
  publisherMustDiffer: boolean;
};

const DEFAULT_PUBLISHER_MUST_DIFFER = true;

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function publisherMustDifferFromBody(value: unknown): boolean {
  if (value === false || value === 0) return false;
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'false' || normalized === '0') return false;
    if (normalized === 'true' || normalized === '1') return true;
  }
  return DEFAULT_PUBLISHER_MUST_DIFFER;
}

export function parseBackofficeConfig(body: unknown): BackofficeConfigResponse {
  if (!body || typeof body !== 'object') {
    return {
      enabled: [],
      available: [],
      publisherMustDiffer: DEFAULT_PUBLISHER_MUST_DIFFER,
    };
  }

  const record = body as Record<string, unknown>;
  const available = stringList(record.available);
  const known = new Set(available);
  return {
    enabled: stringList(record.enabled).filter((id) => known.has(id)),
    available,
    publisherMustDiffer: publisherMustDifferFromBody(record.publisherMustDiffer),
  };
}
