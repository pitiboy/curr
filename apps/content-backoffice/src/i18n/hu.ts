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
    transactions_none: 'Nincs tranzakció.',
    transactions_create_empty: 'Az űrlap a 6. lépésben készül el.',
    transactions_review_empty: 'A draft lista és a publish a 8. lépésben jön.',
    profile: 'Profil',
    profile_name: 'Név',
    profile_email: 'E-mail',
    login_google: 'Bejelentkezés Google-lel (hamarosan)',
    status: {
      draft: 'Piszkozat',
      published: 'Közzétéve',
    },
    filters: {
      status_all: 'Mind',
      date_from: 'Dátumtól',
      date_to: 'Dátumig',
    },
    receipt_yes: 'Van',
    receipt_no: 'Nincs',
  },
  resources: {
    transactions: {
      name: 'Tranzakció |||| Tranzakciók',
      fields: {
        date: 'Dátum',
        amount: 'Összeg',
        description: 'Leírás',
        organization: 'Szervezet',
        debit_account: 'Tartozik',
        credit_account: 'Követel',
        status: 'Státusz',
        receipt: 'Bizonylat',
      },
    },
    organizations: {
      name: 'Szervezet |||| Szervezetek',
      fields: {
        name: 'Név',
      },
    },
    accounts: {
      name: 'Számla |||| Számlák',
      fields: {
        name: 'Név',
        code: 'Kód',
      },
    },
  },
});
