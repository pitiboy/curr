import { deepmerge } from '@mui/utils';
import {
  Admin,
  CustomRoutes,
  Resource,
  defaultDarkTheme,
  defaultLightTheme,
} from 'react-admin';
import { Route } from 'react-router-dom';

import { authProvider } from './auth/authProvider';
import { RoleGuard } from './auth/RoleGuard';
import { dataProvider } from './data/dataProvider';
import { i18nProvider } from './i18n';
import { BackofficeLayout } from './layout/BackofficeLayout';
import { LoginPage } from './login/LoginPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { TransactionCreate } from './pages/transactions/TransactionCreate';
import { TransactionList } from './pages/transactions/TransactionList';
import { TransactionReview } from './pages/transactions/TransactionReview';

const themeWithReadableButtons = {
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none' as const },
      },
    },
  },
};

const lightTheme = deepmerge(defaultLightTheme, themeWithReadableButtons);
const darkTheme = deepmerge(defaultDarkTheme, themeWithReadableButtons);

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
      title="app.title"
    >
      <Resource
        list={TransactionList}
        name="transactions"
        options={{ label: 'app.transactions_list' }}
      />
      <CustomRoutes>
        <Route
          element={
            <RoleGuard allow={['dataentry']}>
              <TransactionCreate />
            </RoleGuard>
          }
          path="/transactions/create"
        />
        <Route
          element={
            <RoleGuard allow={['qa']}>
              <TransactionReview />
            </RoleGuard>
          }
          path="/transactions/review"
        />
        <Route element={<ProfilePage />} path="/profile" />
      </CustomRoutes>
    </Admin>
  );
}
