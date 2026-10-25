import { Admin, CustomRoutes, Resource } from 'react-admin';
import { Route } from 'react-router-dom';

import { authProvider } from './auth/authProvider';
import { RoleGuard } from './auth/RoleGuard';
import { dataProvider } from './data/dataProvider';
import { i18nProvider } from './i18n';
import { AppTitle } from './layout/AppTitle';
import { BackofficeLayout } from './layout/BackofficeLayout';
import { LoginPage } from './login/LoginPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { TransactionCreate } from './pages/transactions/TransactionCreate';
import { TransactionList } from './pages/transactions/TransactionList';
import { TransactionShow } from './pages/transactions/TransactionShow';
import { darkTheme, lightTheme } from './theme';
import { workflowForms } from './workflows/registry';
import { WorkflowFormGate } from './workflows/WorkflowFormGate';

export function App() {
  return (
    <Admin
      authProvider={authProvider}
      darkTheme={darkTheme}
      dataProvider={dataProvider}
      i18nProvider={i18nProvider}
      layout={BackofficeLayout}
      lightTheme={lightTheme}
      loginPage={LoginPage}
      title={<AppTitle />}
    >
      <Resource
        list={TransactionList}
        name="transactions"
        options={{ label: 'app.transactions_list' }}
        show={TransactionShow}
      />
      <CustomRoutes>
        <Route
          element={
            <RoleGuard allow={['dataentry', 'editor']}>
              <TransactionCreate />
            </RoleGuard>
          }
          path="/transactions/create"
        />
        <Route element={<ProfilePage />} path="/profile" />
        {workflowForms.map((form) => (
          <Route
            key={form.id}
            element={
              <WorkflowFormGate roles={form.roles} workflowId={form.id}>
                {form.element}
              </WorkflowFormGate>
            }
            path={form.path}
          />
        ))}
      </CustomRoutes>
    </Admin>
  );
}
