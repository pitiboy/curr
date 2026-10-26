export type BackofficeFeatureRow = {
  key: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
};

export type BackofficeFeatureState = {
  enabled: boolean;
  config: Record<string, unknown> | null;
};

export type BackofficeConfigResponse = {
  /** Workflow ids that are enabled in the menu. */
  enabled: string[];
  /** Every workflow id row in the database (setting keys excluded). */
  available: string[];
  publisherMustDiffer: boolean;
  debitCodesPattern: string;
  creditCodesPattern: string;
  /** Brand prefix for the SPA app bar (`app.title` setting). Empty omits the prefix. */
  appTitle: string;
  eggSaleCurrency: string;
  /** All rows keyed by `key` (workflows and settings). */
  features: Record<string, BackofficeFeatureState>;
};

export type BackofficeFeatureSeedEntry = {
  key: string;
  enabled?: boolean;
  config?: Record<string, unknown> | null;
};
