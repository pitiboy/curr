export type BackofficeFeatureState = {
  enabled: boolean;
  config: Record<string, unknown> | null;
};

export type BackofficeConfigResponse = {
  enabled: string[];
  available: string[];
  publisherMustDiffer: boolean;
  debitCodesPattern: string;
  creditCodesPattern: string;
  /** Brand prefix from Settings `app.title`. Empty omits the prefix. */
  appTitle: string;
  eggSaleCurrency: string;
  features: Record<string, BackofficeFeatureState>;
};

const DEFAULT_PUBLISHER_MUST_DIFFER = true;
const DEFAULT_DEBIT_PATTERN = '/^5/';
const DEFAULT_CREDIT_PATTERN = '/^(1|3)/';
const DEFAULT_APP_TITLE = '';
const DEFAULT_EGG_SALE_CURRENCY = 'HUF';

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

function patternFromBody(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function parseFeatures(value: unknown): Record<string, BackofficeFeatureState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, BackofficeFeatureState> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    out[key] = {
      enabled: row.enabled === true,
      config:
        row.config != null &&
        typeof row.config === 'object' &&
        !Array.isArray(row.config)
          ? (row.config as Record<string, unknown>)
          : null,
    };
  }
  return out;
}

export function parseBackofficeConfig(body: unknown): BackofficeConfigResponse {
  if (!body || typeof body !== 'object') {
    return {
      enabled: [],
      available: [],
      publisherMustDiffer: DEFAULT_PUBLISHER_MUST_DIFFER,
      debitCodesPattern: DEFAULT_DEBIT_PATTERN,
      creditCodesPattern: DEFAULT_CREDIT_PATTERN,
      appTitle: DEFAULT_APP_TITLE,
      eggSaleCurrency: DEFAULT_EGG_SALE_CURRENCY,
      features: {},
    };
  }

  const record = body as Record<string, unknown>;
  const available = stringList(record.available);
  const known = new Set(available);
  return {
    enabled: stringList(record.enabled).filter((id) => known.has(id)),
    available,
    publisherMustDiffer: publisherMustDifferFromBody(
      record.publisherMustDiffer,
    ),
    debitCodesPattern: patternFromBody(
      record.debitCodesPattern,
      DEFAULT_DEBIT_PATTERN,
    ),
    creditCodesPattern: patternFromBody(
      record.creditCodesPattern,
      DEFAULT_CREDIT_PATTERN,
    ),
    appTitle:
      typeof record.appTitle === 'string' && record.appTitle.trim().length > 0
        ? record.appTitle.trim()
        : DEFAULT_APP_TITLE,
    eggSaleCurrency:
      typeof record.eggSaleCurrency === 'string' &&
      record.eggSaleCurrency.trim().length > 0
        ? record.eggSaleCurrency.trim()
        : DEFAULT_EGG_SALE_CURRENCY,
    features: parseFeatures(record.features),
  };
}

export function eggSaleCurrencyForWorkflow(
  config: BackofficeConfigResponse,
  workflowId: string,
): string {
  const workflowConfig = config.features[workflowId]?.config;
  const fromWorkflow =
    workflowConfig &&
    typeof workflowConfig.saleCurrency === 'string' &&
    workflowConfig.saleCurrency.trim().length > 0
      ? workflowConfig.saleCurrency.trim()
      : undefined;
  return fromWorkflow ?? config.eggSaleCurrency;
}
