/** Setting rows use a dotted prefix; everything else is treated as a workflow id. */
export const BACKOFFICE_SETTING_PREFIXES = [
  'content.',
  'accounts.',
  'app.',
] as const;

export const BACKOFFICE_SETTING_KEYS = {
  defaultStatus: 'content.default_status',
  publisherMustDiffer: 'content.publisher_must_differ',
  debitCodes: 'accounts.debit_codes',
  creditCodes: 'accounts.credit_codes',
  eggSaleCurrency: 'app.egg_sale_currency',
} as const;

export const BACKOFFICE_FEATURE_UID =
  'api::backoffice-feature.backoffice-feature';

export const DEFAULT_DEBIT_CODES_PATTERN = '/^5/';
export const DEFAULT_CREDIT_CODES_PATTERN = '/^(1|3)/';
export const DEFAULT_EGG_SALE_CURRENCY = 'HUF';
