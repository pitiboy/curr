/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRAPI_URL: string;
  readonly VITE_APP_TITLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
