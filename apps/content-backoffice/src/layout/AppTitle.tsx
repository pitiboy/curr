import { useEffect } from 'react';
import { useTranslate } from 'react-admin';

import { useBackofficeConfig } from '../workflows/useBackofficeConfig';

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

/** App bar heading. */
export function AppTitle() {
  return useAppTitle();
}
