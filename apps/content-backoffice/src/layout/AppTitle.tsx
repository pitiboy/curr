import { useTranslate } from 'react-admin';

import { APP_TITLE } from '../config';

/** App bar and default title: `VITE_APP_TITLE » app.title`. */
export function AppTitle() {
  const translate = useTranslate();
  const label = translate('app.title');
  const brand = APP_TITLE.trim();

  return brand ? `${brand} » ${label}` : label;
}
