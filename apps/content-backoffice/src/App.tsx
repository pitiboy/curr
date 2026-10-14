import { Admin } from 'react-admin';
import { EmptyReady } from './EmptyReady';
import { noopDataProvider } from './dataProvider';
import { i18nProvider } from './i18n';

export const App = () => (
  <Admin
    dataProvider={noopDataProvider}
    i18nProvider={i18nProvider}
    ready={EmptyReady}
    title="Kiadások"
  />
);
