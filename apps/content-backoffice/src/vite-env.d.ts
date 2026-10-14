/// <reference types="vite/client" />

declare module 'ra-language-hungarian' {
  import type { TranslationMessages } from 'ra-core';
  const messages: TranslationMessages;
  export default messages;
}

interface ImportMetaEnv {
  readonly VITE_STRAPI_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

