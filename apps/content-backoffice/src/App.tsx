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
import { EggInventoryReportPage } from './pages/reports/EggInventoryReportPage';
import { MembershipShareReportPage } from './pages/reports/MembershipShareReportPage';
import { MEMBERSHIP_SHARE_FEATURE_ID } from './pages/reports/membershipShare/types';
import { TransactionCreate } from './pages/transactions/TransactionCreate';
import { TransactionList } from './pages/transactions/TransactionList';
import { TransactionShow } from './pages/transactions/TransactionShow';
import { darkTheme, lightTheme } from './theme';
import { eggDailyEntryConfig } from './workflows/bulk-quantity/configs/eggDailyEntry.config';
import { BackofficeConfigProvider } from './workflows/BackofficeConfigProvider';
import { workflowForms } from './workflows/registry';
import { WorkflowFormGate } from './workflows/WorkflowFormGate';

export function App() {
  return (
    <BackofficeConfigProvider>
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
          <Route
            element={
              <WorkflowFormGate
                roles={eggDailyEntryConfig.roles}
                workflowId={eggDailyEntryConfig.workflowId}
              >
                <EggInventoryReportPage />
              </WorkflowFormGate>
            }
            path="/reports/egg-inventory"
          />
          <Route
            element={
              <WorkflowFormGate
                roles={['dataentry', 'editor']}
                workflowId={MEMBERSHIP_SHARE_FEATURE_ID}
              >
                <MembershipShareReportPage />
              </WorkflowFormGate>
            }
            path="/reports/membership-share"
          />
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
    </BackofficeConfigProvider>
  );
}
