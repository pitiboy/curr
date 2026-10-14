import hungarianMessages from 'ra-language-hungarian';
import { mergeTranslations } from 'react-admin';

/** Hungarian message catalog (react-admin + app labels). */
export const huMessages = mergeTranslations(hungarianMessages, {
  app: {
    title: 'Tartalom kezelő',
    menu_placeholder: 'Nincs menüpont',
  },
});
