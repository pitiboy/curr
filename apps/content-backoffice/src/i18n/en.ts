import englishMessages from 'ra-language-english';
import { mergeTranslations } from 'react-admin';

/** English message catalog (react-admin + app labels). */
export const enMessages = mergeTranslations(englishMessages, {
  app: {
    title: 'Content backoffice',
    menu_placeholder: 'No menu items',
  },
});
