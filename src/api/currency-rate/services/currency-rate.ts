/**
 * currency-rate service
 */

import { factories } from '@strapi/strapi';

import {
  findLatestCurrencyRate,
  type ConvertContextStrapi,
} from '../../../transaction-workflow/convert-context';

export default factories.createCoreService(
  'api::currency-rate.currency-rate',
  ({ strapi }) => ({
    /**
     * Latest direct `from → to` rate with valid_from ≤ end of `onOrBeforeDate`
     * (UTC day, inclusive). No inverse fallback; same currency → rate 1.
     */
    async findLatestRate(params: {
      fromDocumentId: string;
      toDocumentId: string;
      onOrBeforeDate: string;
    }) {
      return findLatestCurrencyRate(strapi as unknown as ConvertContextStrapi, {
        fromCurrencyDocumentId: params.fromDocumentId,
        toCurrencyDocumentId: params.toDocumentId,
        date: params.onOrBeforeDate,
      });
    },
  }),
);
