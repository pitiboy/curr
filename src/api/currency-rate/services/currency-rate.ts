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
     * Latest `from → to` rate with valid_from ≤ end of `onOrBeforeDate`
     * (UTC day, inclusive). Same currency → rate 1. KOR pairs may invert
     * `to → from` when the direct row is missing (pass currency codes).
     */
    async findLatestRate(params: {
      fromDocumentId: string;
      toDocumentId: string;
      onOrBeforeDate: string;
      fromCode?: string | null;
      toCode?: string | null;
    }) {
      return findLatestCurrencyRate(strapi as unknown as ConvertContextStrapi, {
        fromCurrencyDocumentId: params.fromDocumentId,
        toCurrencyDocumentId: params.toDocumentId,
        date: params.onOrBeforeDate,
        fromCode: params.fromCode,
        toCode: params.toCode,
      });
    },
  }),
);
