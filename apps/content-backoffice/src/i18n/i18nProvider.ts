import polyglotI18nProvider from 'ra-i18n-polyglot';
import englishMessages from './en';
import hungarianMessages from './hu';

const messages = {
  hu: hungarianMessages,
  en: englishMessages,
};

export const i18nProvider = polyglotI18nProvider(
  (locale) => (locale === 'en' ? messages.en : messages.hu),
  'hu',
  [
    { locale: 'hu', name: 'Magyar' },
    { locale: 'en', name: 'English' },
  ],
);
