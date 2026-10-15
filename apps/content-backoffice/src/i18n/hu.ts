import hungarianMessages from 'ra-language-hungarian';
import { mergeTranslations } from 'react-admin';

/** Hungarian message catalog (react-admin + app labels). */
export const huMessages = mergeTranslations(hungarianMessages, {
  app: {
    title: 'Kezelő felület',
    menu_placeholder: 'Nincs menüpont',
    transactions_list: 'Tranzakciók',
    transactions_create: 'Új tranzakció',
    transactions_review: 'Ellenőrzés',
    transactions_none: 'Nincs tranzakció.',
    transactions_review_empty: 'Nincs piszkozat.',
    transactions_review_hint:
      'A piszkozat bizonylatai innen nyithatók meg. Új fájl csatolása kihagyható.',
    accounts_seed_missing: 'A számlalista üres, mert a seed hiányzik.',
    profile: 'Profil',
    profile_name: 'Név',
    profile_email: 'E-mail',
    profile_password_heading: 'Jelszó módosítása',
    profile_password_current: 'Jelenlegi jelszó',
    profile_password_new: 'Új jelszó',
    profile_password_confirm: 'Új jelszó megerősítése',
    profile_password_submit: 'Jelszó mentése',
    profile_password_success: 'A jelszó frissült.',
    profile_password_mismatch: 'Az új jelszók nem egyeznek.',
    profile_password_error: 'A jelszó mentése nem sikerült.',
    feature_flags: 'Feature flagek',
    feature_flags_empty: 'Nincs kapcsolható ügylet.',
    feature_flags_reset: 'Szerver szerinti lista',
    login_google: 'Bejelentkezés Google-lel',
    status: {
      draft: 'Piszkozat',
      published: 'Közzétéve',
    },
    filters: {
      status_all: 'Mind',
      date_from: 'Dátumtól',
      date_to: 'Dátumig',
      created_from: 'Rögzítve ettől',
      created_to: 'Rögzítve eddig',
      amount_from: 'Összegtől',
      amount_to: 'Összegig',
    },
    receipt_yes: 'Van',
    receipt_no: 'Nincs',
    receipt_block: 'Bizonylatok',
    receipt_optional:
      'A bizonylat kihagyható. Fájl nélkül nem jön létre bizonylat.',
    receipt_drop: 'Húzd ide a fájlt, vagy kattints a tallózáshoz.',
    receipt_clear: 'Fájl elvetése',
    receipt_vendor: 'Eladó',
    receipt_vendor_hint: 'Fájl csatolásakor az eladó kötelező.',
    receipt_type: 'Bizonylattípus',
    receipt_add: 'Új bizonylat',
    receipt_remove: 'Elvetés',
    receipt_card_required:
      'Fájl csatolásakor az eladó és a bizonylattípus kötelező.',
    receipt_prefill:
      'A dátum, az összeg és a leírás a tranzakcióból kerül a bizonylatra.',
    receipt_description_required: 'Fájl csatolásakor a leírás kötelező.',
    receipt_open: 'Megnyitás',
    receipt_save: 'Bizonylat mentése',
    receipt_saved: 'A bizonylat mentve.',
  },
  resources: {
    transactions: {
      name: 'Tranzakció |||| Tranzakciók',
      fields: {
        date: 'Dátum',
        createdAt: 'Rögzítve',
        amount: 'Összeg',
        description: 'Leírás',
        organization: 'Szervezet',
        debit_account: 'Költség számla',
        credit_account: 'Kifizető számla',
        currency_type: 'Pénznem',
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
