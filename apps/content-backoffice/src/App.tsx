import { Admin } from 'react-admin';
import { noopDataProvider } from './dataProvider';
import { i18nProvider } from './i18n';

export const App = () => (
  <Admin
    dataProvider={noopDataProvider}
    i18nProvider={i18nProvider}
    title="Kiadások"
  />
);
