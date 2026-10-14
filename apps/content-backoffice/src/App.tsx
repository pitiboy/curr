import { Admin, Layout, Title, useDefaultTitle } from 'react-admin';

import { noopDataProvider } from './dataProvider';
import { i18nProvider } from './i18n';

/** Frame until a resource exists. The default Ready splash skips Layout and i18n. */
function EmptyFrame() {
  const defaultTitle = useDefaultTitle();

  return (
    <Layout>
      <Title defaultTitle={defaultTitle} preferenceKey={false} />
    </Layout>
  );
}

export function App() {
  return (
    <Admin
      dataProvider={noopDataProvider}
      i18nProvider={i18nProvider}
      ready={EmptyFrame}
      requireAuth={false}
      title="Tartalom kezelő"
    />
  );
}
