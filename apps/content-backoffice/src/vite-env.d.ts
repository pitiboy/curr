/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRAPI_URL: string;
  readonly VITE_APP_TITLE?: string;
  /** JavaScript regex, `/^5/` or `^5`. Defaults to `/^5/` when unset. */
  readonly VITE_DEBIT_CODES?: string;
  /** JavaScript regex, `/^(1|3)/` or `^(1|3)`. Defaults to `/^(1|3)/` when unset. */
  readonly VITE_CREDIT_CODES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
