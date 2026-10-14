import { Admin } from 'react-admin';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from './dashboard/Dashboard';
import { emptyDataProvider } from './emptyDataProvider';
import { i18nProvider } from './i18n/i18nProvider';
import { AppLayout } from './layout/AppLayout';
import { ReadyFrame } from './layout/ReadyFrame';

const App = () => (
  <BrowserRouter basename="/backoffice">
    <Admin
      title="KÖR"
      dashboard={Dashboard}
      dataProvider={emptyDataProvider}
      i18nProvider={i18nProvider}
      layout={AppLayout}
      ready={ReadyFrame}
      disableTelemetry
    />
  </BrowserRouter>
);

export default App;
