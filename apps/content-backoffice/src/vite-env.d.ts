/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Strapi origin when the SPA is not same-origin with it (e2e `vite preview`). */
  readonly VITE_STRAPI_URL?: string;
}
