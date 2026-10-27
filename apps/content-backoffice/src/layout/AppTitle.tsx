import { useEffect } from 'react';
import { useTranslate } from 'react-admin';

import { STRAPI_URL } from '../config';
import { useBackofficeConfig } from '../workflows/useBackofficeConfig';

/** Same origin as Strapi admin tab icon (`strapi::favicon` → `/favicon.ico`). */
export const STRAPI_FAVICON_URL = `${STRAPI_URL}/favicon.ico`;

/** `appTitle » app.title` from Settings. An empty brand leaves only the translated label. */
export function useAppTitle() {
  const translate = useTranslate();
  const { appTitle } = useBackofficeConfig();
  const label = translate('app.title');
  const brand = appTitle.trim();

  return brand ? `${brand} » ${label}` : label;
}

/** Browser tab title. Mount on login and inside the layout; both are outside each other. */
export function DocumentTitle() {
  const title = useAppTitle();

  useEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}

/** Browser tab icon from Strapi. Mount with DocumentTitle. */
export function DocumentFavicon() {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/x-icon';
    link.href = STRAPI_FAVICON_URL;
  }, []);

  return null;
}

/** App bar heading. */
export function AppTitle() {
  return useAppTitle();
}
