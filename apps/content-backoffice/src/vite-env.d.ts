/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Strapi origin when the SPA is not same-origin with it (e2e `vite preview`). */
  readonly VITE_STRAPI_URL?: string;
  /** Git short SHA or build timestamp baked in at Vite build time. */
  readonly VITE_BUILD_ID: string;
}
