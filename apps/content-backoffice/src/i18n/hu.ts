import hungarianMessages from 'ra-language-hungarian';
import { mergeTranslations } from 'react-admin';

/** Hungarian message catalog (react-admin + app labels). */
export const huMessages = mergeTranslations(hungarianMessages, {
  app: {
    title: 'Kezelő felület',
    menu_placeholder: 'Nincs menüpont',
    transactions_list: 'Tranzakciók',
    transactions_create: 'Új tranzakció',
    transactions_review: 'Véglegesítés',
    transactions_show: 'Megtekintés',
    transactions_none: 'Nincs tranzakció.',
    transactions_finalize: 'Véglegesít',
    description_clear_comments: 'Megjegyzések kitakarítása',
    transactions_finalized: 'A tranzakció véglegesítve.',
    transactions_finalize_hint:
      'Ez a tranzakció még nincs véglegesítve, ami azt jelenti, hogy nem jelenik meg minden kimutatásban. Miután átnézte és rendben találta az adatokat és a kapcsolt bizonylatokat, véglegesítse a tranzakciót és a bizonylatokat.',
    transactions_finalize_no_receipt:
      'Ehhez a tranzakcióhoz nincs csatolt bizonylat. Véglegesítés után már nem lehet bizonylatot feltölteni, ezért csak akkor véglegesítse, ha biztos benne, hogy nem érkezik hozzá várható bizonylat.',
    transactions_finalize_pending:
      'A csatolt fájl még nincs mentve. Előbb mentsd a bizonylatot.',
    transactions_finalize_same_person:
      'A módosítások elmentve, a tranzakció piszkozat maradt. A rögzítő nem véglegesítheti a saját tranzakcióját.',
    transactions_leave_title: 'A tranzakció még piszkozat',
    transactions_leave_body: 'A véglegesítés még hátravan. Elhagyod az oldalt?',
    transactions_leave_unsaved_title: 'A tranzakció még nincs mentve',
    transactions_leave_unsaved_body:
      'A kitöltött adatok elvesznek. Elhagyod az oldalt?',
    transactions_leave_go: 'Elhagyom',
    transactions_leave_stay: 'Maradok',
    accounts_seed_missing: 'A számlalista üres, mert a seed hiányzik.',
    account_profile: 'Számlaprofil',
    account_profile_all: 'Minden számla',
    account_profile_cost: 'Költség',
    account_profile_egg: 'Tojás (EGG)',
    profile: 'Profil',
    profile_name: 'Név',
    profile_email: 'E-mail',
    profile_role: 'Szerepkör',
    roles: {
      editor: 'Szerkesztő',
      dataentry: 'Adatrögzítő',
      authenticated: 'Bejelentkezett felhasználó',
    },
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
    workflows: {
      'egg-daily-entry': 'Napi tojás rögzítés',
      'member-fee': 'Tagdíj',
    },
    bulk_quantity: {
      save: 'Mentés',
      catalog_missing:
        'A szükséges törzsadat hiányzik (ól, számla, pénznem vagy tranzakciótípus).',
      no_hen_houses: 'Nincs tyúkól a szervezeti fában.',
      no_rows: 'Adj meg legalább egy nem nulla darabszámot.',
      invalid_quantity: 'Egész szám, 0 vagy nagyobb.',
      results_heading: 'Mentés eredménye',
      retry_failed: 'Sikertelen sorok újrapróbálása',
      conflict_title: 'Már van rögzítés erre a napra',
      conflict_body:
        'Ugyanerre a napra, ólra és könyvelési párosra már létezik tranzakció. Válaszd ki, mit tegyünk soronként.',
      conflict_existing: 'Meglévő összeg: %{amount}',
      conflict_update: 'Meglévő sor frissítése',
      conflict_insert: 'Új sor felvétele',
      conflict_continue: 'Folytatás',
      description: {
        egg: 'Napi tojás — %{organization}: %{amount} db',
      },
    },
    login_google: 'Bejelentkezés Google-lel',
    oauth_errors: {
      register_not_available:
        'Ehhez a Google-fiókhoz nincs felhasználó. Kérd meg az adminisztrátort, hogy vegyen fel ezzel az e-mail-címmel.',
      ambiguous_email:
        'Ezzel az e-mail-címmel több felhasználó is létezik. Kérd meg az adminisztrátort, hogy rendezze.',
      account_blocked: 'A fiókodat az adminisztrátor letiltotta.',
      email_not_confirmed: 'A fiókod e-mail-címe még nincs megerősítve.',
      email_not_available:
        'A Google nem adta át az e-mail-címedet, így nem tudunk beléptetni.',
      email_taken: 'Ez az e-mail-cím már egy másik fiókhoz tartozik.',
      session_missing: 'A Google-belépés megszakadt. Próbáld újra.',
      provider_disabled: 'A Google-belépés jelenleg ki van kapcsolva.',
    },
    static_nav: 'Statikus oldalak',
    static_privacy: 'Adatkezelési tájékoztató',
    static_terms: 'Felhasználási feltételek',
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
      'A bizonylat feltöltése nem kötelező, feltöltött Fájl nélkül nem kapcsolunk bizonylatot.',
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
      'Azonban ha bizonylat feltöltésre kerül, később már módosítani nem lehet. \nÚj bizonylatot fel lehet tölteni később is, amíg a tranzakció nincs még véglegesítve.  ',
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
        debit_account: 'Költség számla', // Tartozik
        credit_account: 'Kifizető számla', // Követel
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
