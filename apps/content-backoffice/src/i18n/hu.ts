import hungarianMessages from 'ra-language-hungarian';
import { mergeTranslations } from 'react-admin';

/** Hungarian message catalog (react-admin + app labels). */
export const huMessages = mergeTranslations(hungarianMessages, {
  app: {
    title: 'Tartalom kezelő',
    menu_placeholder: 'Nincs menüpont',
    transactions_list: 'Tranzakciók',
    transactions_create: 'Új tranzakció',
    transactions_review: 'Ellenőrzés',
    transactions_list_empty: 'A tranzakciólista a 4. lépésben kap adatot.',
    transactions_create_empty: 'Az űrlap a 6. lépésben készül el.',
    transactions_review_empty: 'A draft lista és a publish a 8. lépésben jön.',
    profile: 'Profil',
    profile_name: 'Név',
    profile_email: 'E-mail',
    login_google: 'Bejelentkezés Google-lel (hamarosan)',
  },
});
