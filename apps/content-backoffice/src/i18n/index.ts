import polyglotI18nProvider from 'ra-i18n-polyglot';
import { enMessages } from './en';
import { huMessages } from './hu';

export const i18nProvider = polyglotI18nProvider(
  (locale) => (locale === 'en' ? enMessages : huMessages),
  'hu',
  [
    { locale: 'hu', name: 'Magyar' },
    { locale: 'en', name: 'English' },
  ],
);
