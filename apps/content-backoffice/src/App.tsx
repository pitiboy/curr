import { Provider as JotaiProvider } from 'jotai';
import { Admin, CustomRoutes, Resource } from 'react-admin';
import { Route } from 'react-router-dom';

import { authProvider } from './auth/authProvider';
import { CONTENT_ROLES } from './auth/roles';
import { RoleGuard } from './auth/RoleGuard';
import { dataProvider } from './data/dataProvider';
import { i18nProvider } from './i18n';
import { AppTitle } from './layout/AppTitle';
import { BackofficeLayout } from './layout/BackofficeLayout';
import { LoginPage } from './login/LoginPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { EggInventoryReportPage } from './pages/reports/EggInventoryReportPage';
import { HenInventoryReportPage } from './pages/reports/HenInventoryReportPage';
import { MembershipLedgerReportPage } from './pages/reports/MembershipLedgerReportPage';
import { MembershipShareReportPage } from './pages/reports/MembershipShareReportPage';
import { ProjectBalanceReportPage } from './pages/reports/ProjectBalanceReportPage';
import { MEMBERSHIP_LEDGER_FEATURE_ID } from './pages/reports/membershipLedger/types';
import { MEMBERSHIP_SHARE_FEATURE_ID } from './pages/reports/membershipShare/types';
import { PROJECT_BALANCE_FEATURE_ID } from './pages/reports/projectBalance/types';
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
      <JotaiProvider>
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
                <RoleGuard allow={[...CONTENT_ROLES]}>
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
                  roles={eggDailyEntryConfig.roles}
                  workflowId={eggDailyEntryConfig.workflowId}
                >
                  <HenInventoryReportPage />
                </WorkflowFormGate>
              }
              path="/reports/hen-inventory"
            />
            <Route
              element={
                <WorkflowFormGate
                  roles={CONTENT_ROLES}
                  workflowId={MEMBERSHIP_SHARE_FEATURE_ID}
                >
                  <MembershipShareReportPage />
                </WorkflowFormGate>
              }
              path="/reports/membership-share"
            />
            <Route
              element={
                <WorkflowFormGate
                  roles={CONTENT_ROLES}
                  workflowId={MEMBERSHIP_LEDGER_FEATURE_ID}
                >
                  <MembershipLedgerReportPage />
                </WorkflowFormGate>
              }
              path="/reports/membership-ledger"
            />
            <Route
              element={
                <WorkflowFormGate
                  roles={CONTENT_ROLES}
                  workflowId={PROJECT_BALANCE_FEATURE_ID}
                >
                  <ProjectBalanceReportPage />
                </WorkflowFormGate>
              }
              path="/reports/project-balance"
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
      </JotaiProvider>
    </BackofficeConfigProvider>
  );
}
