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
    transactions_show: 'Megtekintés',
    transactions_none: 'Nincs tranzakció.',
    transactions_finalize: 'Véglegesít',
    transactions_finalized: 'A tranzakció véglegesítve.',
    transactions_finalize_hint:
      'Ez a tranzakció még nincs véglegesítve, ami azt jelenti, hogy nem jelenik meg a kimutatásokban. Miután átnézte és rendben találta az adatokat és a kapcsolt bizonylatokat, véglegesítse a tranzakciót és a bizonylatokat.',
    transactions_finalize_pending:
      'A csatolt fájl még nincs mentve. Előbb mentsd a bizonylatot.',
    transactions_finalize_same_person:
      'A rögzítő nem véglegesítheti a saját tranzakcióját.',
    transactions_leave_title: 'A tranzakció még piszkozat',
    transactions_leave_body: 'A véglegesítés még hátravan. Elhagyod az oldalt?',
    transactions_leave_unsaved_title: 'A tranzakció még nincs mentve',
    transactions_leave_unsaved_body:
      'A kitöltött adatok elvesznek. Elhagyod az oldalt?',
    transactions_leave_go: 'Elhagyom',
    transactions_leave_stay: 'Maradok',
    accounts_seed_missing: 'A számlalista üres, mert a seed hiányzik.',
    profile: 'Profil',
    profile_name: 'Név',
    profile_email: 'E-mail',
    feature_flags: 'Feature flagek',
    feature_flags_empty: 'Nincs kapcsolható ügylet.',
    feature_flags_reset: 'Szerver szerinti lista',
    login_google: 'Bejelentkezés Google-lel (hamarosan)',
    status: {
      draft: 'Piszkozat',
      published: 'Közzétéve',
    },
    filters: {
      status_all: 'Mind',
      clear: 'Szűrők törlése',
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
        entered_by: 'Rögzítette',
        published_by: 'Közzétette',
        publishedAt: 'Közzétéve',
        amount: 'Összeg',
        description: 'Leírás',
        organization: 'Szervezet',
        debit_account: 'Költség számla',
        credit_account: 'Kifizető számla',
        currency_type: 'Pénznem',
        vendor: 'Eladó',
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
