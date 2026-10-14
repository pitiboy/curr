import { strapiDataProvider, strapiHttpClient } from 'ra-strapi';

import { STRAPI_URL } from '../config';
import { withDocumentId } from './withDocumentId';

const httpClient = strapiHttpClient();

export const dataProvider = withDocumentId(
  strapiDataProvider({ baseURL: STRAPI_URL, httpClient }),
);
