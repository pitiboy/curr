import { Admin } from 'react-admin';

import { noopDataProvider } from './dataProvider';
import { i18nProvider } from './i18n';

export function App() {
  return (
    <Admin
      basename="/backoffice"
      dataProvider={noopDataProvider}
      i18nProvider={i18nProvider}
      requireAuth={false}
      title="Tartalom kezelő"
    />
  );
}
