import {
  strapiAuthProvider,
  strapiDataProvider,
  strapiHttpClient,
} from 'ra-strapi';
import { Admin, LoginWithEmail } from 'react-admin';

const STRAPI_URL = import.meta.env.VITE_STRAPI_URL ?? 'http://localhost:1337';
const authProvider = strapiAuthProvider({ baseURL: STRAPI_URL });
const httpClient = strapiHttpClient();
const dataProvider = strapiDataProvider({
  baseURL: STRAPI_URL,
  httpClient,
});

export const App = () => (
  <Admin
    basename="/backoffice"
    dataProvider={dataProvider}
    authProvider={authProvider}
    loginPage={LoginWithEmail}
    requireAuth
  />
);
