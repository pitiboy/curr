import { useEffect } from 'react';
import { useTranslate } from 'react-admin';

import { APP_TITLE } from '../config';

/** `VITE_APP_TITLE » app.title`. An empty prefix leaves only the translated label. */
export function useAppTitle() {
  const translate = useTranslate();
  const label = translate('app.title');
  const brand = APP_TITLE.trim();

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
