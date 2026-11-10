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
    transactions_convert: 'Ügylet kifejtése',
    transactions_convert_save: 'Mentés és ügylet kifejtése',
    transactions_convert_title: 'Ügylet kifejtése: %{name}',
    transactions_convert_body:
      'A tranzakcióból a sablon szerinti sorok készülnek (storno / lépések). Folytatod?',
    transactions_convert_confirm: 'Kifejtés',
    transactions_convert_done: 'Az ügylet kifejtve.',
    transactions_convert_error: 'Az ügylet kifejtése nem sikerült.',
    transactions_convert_organization_required:
      'Ehhez az ügylet-sablonhoz kötelező a szervezet.',
    transactions_convert_ambiguous:
      'Több ügylet-sablon is illik erre a tranzakcióra.',
    transactions_convert_preview: 'Kifejtés előnézete',
    transactions_convert_preview_loading: 'Előnézet betöltése…',
    transactions_convert_preview_error: 'Az előnézet nem tölthető be.',
    transactions_convert_preview_empty: 'Nincs megjeleníthető előnézet.',
    transactions_convert_preview_disabled:
      'Töltsd ki a dátumot, összeget, pénznemet és a terhelési/követelési számlát.',
    transactions_convert_preview_keep_original:
      'Az eredeti megmarad (storno + lépések)',
    transactions_convert_preview_delete_original: 'Az eredeti törlődik',
    transactions_convert_preview_steps_published:
      'A lépések published státuszúak',
    transactions_convert_preview_steps_draft: 'A lépések draft státuszúak',
    transactions_convert_preview_legend:
      'A nyíl iránya: követelési számla → terhelési számla.',
    transactions_convert_preview_sequence_legend:
      'Sequence diagram: a számlák felül, szaggatott lifeline; az üzenetek felülről lefelé — nyíl a követelés → terhelés felé.',
    transactions_convert_preview_diagram_aria:
      'Számlák közti mozgás: %{summary}',
    transactions_convert_preview_kind: 'Típus',
    transactions_convert_preview_kind_original: 'Eredeti',
    transactions_convert_preview_kind_storno: 'Storno',
    transactions_convert_preview_kind_step: 'Lépés',
    transactions_convert_preview_description: 'Leírás',
    transactions_convert_preview_debit: 'T terhelés',
    transactions_convert_preview_credit: 'K követelés',
    transactions_convert_preview_amount: 'Összeg',
    transactions_convert_preview_currency: 'Pénznem',
    transactions_convert_preview_steps_total:
      'Lépések összege: %{steps} (eredeti: %{original})',
    transactions_convert_preview_rate: 'árfolyam × %{rate} (%{validFrom}-tól)',
    transactions_convert_preview_rate_same: 'árfolyam × %{rate}',
    transactions_convert_preview_member_ratio:
      'tagsági ratio × %{ratio} (%{membership})',
    transactions_related_children: '%{count} kapcsolódó sor',
    transactions_related_parent: 'Kapcsolódik: %{date} / %{amount}',
    transactions_related_parent_short: 'Kapcsolódik egy másik tranzakcióhoz',
    transactions_related_parent_row: 'szülő',
    transactions_delete_blocked_expanded:
      'Előbb a csoport kifejtett sorait töröld (egyenként vagy a „Kifejtett sorok törlése” gombbal).',
    transactions_delete_blocked_storno: 'Előbb a storno sort töröld.',
    transactions_related_current: 'ez a sor',
    transactions_none: 'Nincs tranzakció.',
    transactions_page_total: 'Összesen (látható sorok)',
    transactions_finalize: 'Véglegesít',
    description_clear_comments: 'Megjegyzések kitakarítása',
    transactions_finalized: 'A tranzakció véglegesítve.',
    transactions_bulk_finalize: 'Véglegesítés',
    transactions_bulk_finalize_title:
      '%{smart_count} tranzakció véglegesítése |||| %{smart_count} tranzakció véglegesítése',
    transactions_bulk_finalize_body:
      'A kijelölt tranzakciók és bizonylataik változatlanok maradnak; nem szerkesztünk adatot, csak véglegesítünk.',
    transactions_bulk_finalize_body_partial:
      'Ebből %{ready} tranzakciót véglegesítünk. %{skipped} kijelölés kimarad (hiányos adat, vagy te rögzítetted — a szerző nem véglegesítheti a saját tranzakcióját).',
    transactions_bulk_finalize_body_partial_no_self_block:
      'Ebből %{ready} tranzakciót véglegesítünk. %{skipped} kijelölés kimarad (hiányos adat vagy nem véglegesíthető).',
    transactions_bulk_finalize_confirm: 'Véglegesít',
    transactions_bulk_done:
      '%{smart_count} tranzakció véglegesítve. |||| %{smart_count} tranzakció véglegesítve.',
    transactions_bulk_incomplete:
      'A kijelöltek közül %{smart_count} még hiányos, ezért nem véglegesíthető. |||| A kijelöltek közül %{smart_count} még hiányos, ezért nem véglegesíthető.',
    transactions_bulk_same_person:
      'A kijelöltek közül %{smart_count} a saját rögzítésed, ezért nem véglegesíthető. |||| A kijelöltek közül %{smart_count} a saját rögzítésed, ezért nem véglegesíthető.',
    transactions_bulk_skipped_incomplete:
      '%{smart_count} hiányos tranzakció kimaradt. |||| %{smart_count} hiányos tranzakció kimaradt.',
    transactions_bulk_skipped_same_person:
      '%{smart_count} saját rögzítésű tranzakció kimaradt. |||| %{smart_count} saját rögzítésű tranzakció kimaradt.',
    transactions_bulk_failed:
      '%{smart_count} tranzakció véglegesítése sikertelen. |||| %{smart_count} tranzakció véglegesítése sikertelen.',
    transactions_bulk_none_ready:
      'Egyetlen kijelölt tranzakció sem véglegesíthető.',
    transactions_finalize_hint:
      'Ez a tranzakció még nincs véglegesítve, ami azt jelenti, hogy nem jelenik meg minden kimutatásban. Miután átnézte és rendben találta az adatokat és a kapcsolt bizonylatokat, véglegesítse a tranzakciót és a bizonylatokat.',
    transactions_finalize_no_receipt:
      'Ehhez a tranzakcióhoz nincs csatolt bizonylat. Véglegesítés után már nem lehet bizonylatot feltölteni, ezért csak akkor véglegesítse, ha biztos benne, hogy nem érkezik hozzá várható bizonylat.',
    transactions_finalize_pending:
      'A csatolt fájl még nincs mentve. Előbb mentsd a bizonylatot.',
    transactions_finalize_same_person:
      'A módosítások elmentve, a tranzakció piszkozat maradt. A rögzítő nem véglegesítheti a saját tranzakcióját.',
    form_issues_count: '%{errors} hiba, %{warnings} figyelmeztetés',
    transactions_create_issues_title: 'Mentés',
    transactions_create_issues_hint:
      'A tranzakció piszkozatként mentődik. A csillagos mezőket töltsd ki; a bizonylat most még elhagyható.',
    transactions_create_no_receipt:
      'Nincs bizonylat csatolva. Mentéshez nem kell, de ha van nálad, töltsd fel most — véglegesítés után már nem lehet.',
    transactions_create_account_suggested:
      '%{field}: még üres. Ellenőrzéskor kötelező lesz — ha tudod, válaszd ki most.',
    transactions_discard: 'Piszkozat törlése',
    transactions_discard_title: 'Piszkozat törlése',
    transactions_discard_body:
      'A tranzakció és a hozzá csatolt piszkozat bizonylatok véglegesen törlődnek. A művelet nem vonható vissza.',
    transactions_discard_confirm: 'Törlés',
    transactions_discard_done: 'A piszkozat tranzakció törölve.',
    transactions_discard_error: 'A piszkozat törlése sikertelen.',
    transactions_delete_row: 'Törlés',
    transactions_delete_row_title: 'Kifejtett sor törlése',
    transactions_delete_row_body:
      'Az alábbi kifejtett sor és a hozzá tartozó bizonylatok (feltöltött fájlokkal) véglegesen törlődnek.',
    transactions_delete_row_done: 'A kifejtett sor törölve.',
    transactions_delete_row_error: 'A sor törlése sikertelen.',
    transactions_delete_any_row_title: 'Tranzakció törlése',
    transactions_delete_any_row_body:
      'Az alábbi tranzakció és a hozzá tartozó bizonylatok (feltöltött fájlokkal) véglegesen törlődnek. A csoport többi sora megmarad; ha más sorok ehhez kapcsolódtak, a kapcsolatuk megszűnik.',
    transactions_delete_any_row_done: 'A tranzakció törölve.',
    transactions_purge_expansion: 'Kifejtett sorok törlése (%{count})',
    transactions_purge_expansion_hint:
      'A csoportban %{count} kifejtett sor van; ezeket egyszerre is törölheted. Egyes sorokat a sor végi kuka ikonnal törölhetsz.',
    transactions_purge_expansion_title: 'Kifejtett sorok törlése',
    transactions_purge_expansion_rows_body:
      'Az alábbi kifejtett sorok és a hozzájuk tartozó bizonylatok (feltöltött fájlokkal) véglegesen törlődnek. A csoport többi sora megmarad.',
    transactions_purge_expansion_rows_done: 'A kifejtett sorok törölve.',
    transactions_purge_expansion_body:
      'Az alábbi kifejtett és storno sorok, valamint a hozzájuk tartozó bizonylatok (feltöltött fájlokkal) véglegesen törlődnek. Az eredeti tranzakció újra kifejthető lesz.',
    transactions_purge_expansion_done:
      'A kifejtés törölve; az eredeti újra kifejthető.',
    transactions_purge_expansion_error: 'A kifejtés törlése sikertelen.',
    transactions_delete_published_warning:
      'Figyelem: véglegesített (published) tranzakciót törölsz. A könyvelt sorok és bizonylatok visszavonhatatlanul eltűnnek.',
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
    account_profile_revenue: 'Bevétel',
    account_profile_group_profiles: 'Profilok',
    account_profile_group_workflows: 'Ügylet-sablonok',
    account_profile_workflows_loading: 'Sablonok betöltése…',
    account_profile_workflow_prefill_incomplete:
      'A sablon számlakódjai nem egyértelműen találhatók meg — ellenőrizd a számlaválasztókat.',
    account_profile_workflow_dropped:
      'A kiválasztott ügylet-sablon már nem illik a megadott számlákra.',
    reports: {
      range: {
        all: 'Összes',
        thisMonth: 'Ez a hónap',
        lastMonth: 'Előző hónap',
        last7: 'Elmúlt 7 nap',
        thisYear: 'Ez az év',
      },
      transaction_status: {
        label: 'Tranzakciók',
        /** Megfelel a könyvekben közzétett (published) nézetnek — alapértelmezett. */
        preview: 'Közzétéve (éles könyvek)',
        draft: 'Piszkozat',
        all: 'Mind (piszkozat + közzétett)',
      },
    },
    egg_inventory: {
      menu: 'Tojás készlet',
      title: 'Tojás készletkimutatás',
      subtitle:
        'Mennyi tojás termelődött, ment ki (belső / eladás), és mennyi maradt a választott időszakban.',
      range: {
        all: 'Összes',
        thisMonth: 'Ez a hónap',
        lastMonth: 'Előző hónap',
        last7: 'Elmúlt 7 nap',
        thisYear: 'Ez az év',
      },
      kpi: {
        produced: 'Termelt',
        distributed: 'Kiosztott',
        remaining: 'Maradvány',
        internal: 'Belső',
        sale: 'Eladás',
      },
      timeseries_title: 'Mennyiség idősor (alom szerint)',
      trend_total: 'Összesen (trend)',
      alom_title: 'Alom bontás',
      alom_name: 'Alom',
      members_title: 'Tagi egyenleg',
      members_subtitle:
        'Tagonkénti oszlopok egymás mellett, ugyanazzal az időskálával, mint a termelés; alatta a teljes időszak belső/eladás arányai.',
      pie_internal: 'Belső arány tagonként',
      pie_sale: 'Eladás arány tagonként',
      pie_empty: 'Nincs adat ehhez a kördiagramhoz.',
      member_name: 'Tag',
      member_account: 'Számla',
      sale_qty: 'Eladás (db)',
      sale_revenue: 'Eladás bevétel',
      member_total: 'Összesen (db)',
      empty:
        'Nincs megjeleníthető tojásforgalom ebben az időszakban. Válassz másik tartományt.',
      error: 'A kimutatás betöltése nem sikerült.',
      retry: 'Újra',
    },
    hen_inventory: {
      menu: 'Tyúk nyilvántartás',
      title: 'Tyúkállomány kimutatás',
      subtitle:
        'Tojó tyúk készlet almonként időben, levágások és tyúk-átadások tagonként napra bontva.',
      kpi: {
        stock: 'Állomány (időszak vége)',
        intake: 'Beérkezés',
        slaughter: 'Levágás',
        transfer: 'Tyúk átadás',
        mortality: 'Elhullás',
      },
      stock_timeseries_title: 'Állomány idősor (alom szerint)',
      alom_title: 'Alom bontás',
      alom_name: 'Alom',
      slaughter_chart_title: 'Levágások napra és tagra bontva',
      members_title: 'Tagi összesítés (levágás / átadás)',
      member_name: 'Tag',
      member_account: 'Számla',
      member_total: 'Összesen (db)',
      totals_row: 'Összesen',
      slaughter_empty:
        'Nincs tagi tyúkkivét ebben az időszakban. A kimutatás minden HEN 1300→saját könyvelést mutat, beleértve a Levágás sablont is.',
      outflow_empty: 'Nincs levágás vagy átadás ebben az időszakban.',
      empty:
        'Nincs megjeleníthető tyúkforgalom ebben az időszakban. Válassz másik tartományt.',
      error: 'A kimutatás betöltése nem sikerült.',
      retry: 'Újra',
    },
    membership_share: {
      menu: 'Részjegy kimutatás',
      title: 'Tagi részjegy és zseb',
      subtitle:
        'Mennyi tagi befizetés érkezett a 1101 részjegy- és a 1001 zsebszámlákra a választott időszakban, pénznemenként és tagonként.',
      range: {
        all: 'Összes',
        thisMonth: 'Ez a hónap',
        lastMonth: 'Előző hónap',
        last7: 'Elmúlt 7 nap',
        thisYear: 'Ez az év',
      },
      focus: {
        both: 'Mindkettő',
        share: '1101 részjegy',
        pocket: '1001 zseb',
      },
      ledger: {
        share: '1101 részjegy',
        pocket: '1001 zseb',
      },
      kpi: {
        share: '%{code} részjegy · %{currency}',
        pocket: '%{code} zseb · %{currency}',
        members: 'Érintett tagok',
        payments: 'Befizetések száma',
      },
      bar_title: 'Tagonkénti összeg (%{currency})',
      pie_title_ledgers: '1101 / 1001 arány (%{currency})',
      pie_title_currencies: 'Pénznem szerinti bontás',
      members_title: 'Tagi bontás',
      members_subtitle:
        'Részjegy (1101) és zseb (1001) befizetések tagonként, pénznemenként — a pénznemek nem adódnak össze.',
      member_name: 'Tag',
      col: {
        share: '%{code} · %{currency}',
        pocket: '%{code} · %{currency}',
      },
      history_title: 'Befizetések időben (%{currency})',
      history_subtitle:
        'Mikor történt a vagyoni befizetés tagonként — időszakonként egymás melletti oszlopok, színenként a tag.',
      empty:
        'Nincs megjeleníthető tagi befizetés ebben az időszakban. Válassz másik tartományt vagy számlát.',
      error: 'A kimutatás betöltése nem sikerült.',
      retry: 'Újra',
      drilldown: {
        hint: 'Kattintás: szűrt tranzakciólista',
      },
    },
    project_balance: {
      menu: 'Projektek egyenlege',
      title: 'Projektek egyenlege',
      subtitle:
        'Projektenként termelés (bevétel jellegű beérkezés) és beruházás költség-, eszköz-, import- és ügylet-sorokból. Alapból csak közzétett tranzakciók — piszkozatok a „Tranzakciók” szűrőnél.',
      project_filter: 'Projekt (összes)',
      currency: 'Pénznem',
      revenue: 'Termelés',
      cost: 'Beruházás',
      kpi: {
        cumulative: 'Halmozott egyenleg · %{currency}',
        period_revenue: 'Időszaki termelés · %{currency}',
        period_cost: 'Időszaki beruházás · %{currency}',
        period_net: 'Időszaki nettó · %{currency}',
      },
      by_project_title: 'Projektenként: termelés és beruházás (%{currency})',
      history_title: 'Termelés és beruházás időben (%{currency})',
      history_empty: 'Nincs időbeli adat ebben a pénznemben.',
      table_title: 'Projekt táblázat',
      col: {
        project: 'Projekt',
        period_revenue: 'Termelés (%{currency})',
        period_cost: 'Beruházás (%{currency})',
        period_net: 'Profit (%{currency})',
        cumulative: 'Total (%{currency})',
      },
      empty:
        'Nincs megjeleníthető projekt forgalom ebben az időszakban. Válassz másik tartományt vagy státuszt.',
      error: 'A kimutatás betöltése nem sikerült.',
      retry: 'Újra',
      warn_truncated:
        'A betöltött tranzakciók száma elérte a biztonsági limitet — régebbi sorok kimaradhatnak. Szűkítsd az időszakot, vagy később backend összesítés kell.',
      warn_unclassified:
        '%{count} könyvelt sor van projekten, de nem termelés/beruházás minta (pl. csak 1900↔1100 átvezetés). Ügylet kifejtés vagy számlapár ellenőrzés segíthet.',
      drilldown: {
        hint: 'Kattintás: szűrt tranzakciólista',
      },
    },
    profile: 'Profil',
    profile_name: 'Név',
    profile_email: 'E-mail',
    profile_role: 'Szerepkör',
    roles: {
      controller: 'Kontroller',
      editor: 'Szerkesztő',
      dataentry: 'Adatrögzítő',
      controller: 'Kontroller',
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
      'project-balance': 'Projekt egyenleg kimutatás',
      'egg-production': 'Napi tojás rögzítés',
      'member-fee': 'Tagdíj',
      'membership-share': 'Részjegy kimutatás',
    },
    bulk_quantity: {
      save: 'Mentés',
      catalog_missing:
        'A szükséges törzsadat hiányzik (ól, számla, pénznem vagy tranzakciótípus).',
      no_hen_houses: 'Nincs tyúkól a szervezeti fában.',
      no_rows: 'Adj meg legalább egy nem nulla darabszámot.',
      invalid_quantity: 'Egész szám, 0 vagy nagyobb.',
      results_heading: 'Mentés eredménye',
      auto_publish_done: 'Mentve és közzétéve.',
      auto_publish_done_after_update: 'Frissítve és közzétéve.',
      auto_publish_failed: 'Közzététel nem sikerült.',
      retry_failed: 'Sikertelen sorok újrapróbálása',
      conflict_title: 'Már van rögzítés erre a napra',
      conflict_body:
        'Ugyanerre a napra, ólra és könyvelési párosra már létezik tranzakció. Válaszd ki, mit tegyünk soronként.',
      conflict_existing: 'Meglévő összeg: %{amount}',
      conflict_update: 'Meglévő sor frissítése',
      conflict_insert: 'Új sor felvétele',
      conflict_continue: 'Folytatás',
      conflict_global_body:
        'Már van rögzítés erre a napra (termelés vagy továbbosztás). Az alábbi választás minden érintett sorra vonatkozik.',
      step_production: 'Termelés',
      step_distribution: 'Továbbosztás',
      next_distribution: 'Tovább: továbbosztás',
      back_production: 'Vissza: termelés',
      save_production_only: 'Csak termelés mentése',
      save_production_and_distribution: 'Termelés és továbbosztás mentése',
      distribution_produced: 'Mai termelés összesen: %{count} db',
      distribution_remaining: 'Még kiosztatlan: %{count} db',
      distribution_over_limit:
        'A kiosztás %{count} db-tal meghaladja a mai termelést. A mentés engedélyezett (azt az előző napi raktár adagokból osztjuk ki).',
      distribution_rate:
        'Árfolyam (%{from} → %{to}): %{rate}, érvényes %{date} óta',
      distribution_rate_missing:
        'Nincs %{from} → %{to} árfolyam a kiválasztott napra; az értékesítési sorok nem menthetők.',
      distribution_no_members:
        'Nincs tag a(z) „%{org}” szervezetben ehhez a naphoz.',
      distribution_members_failed: 'A taglista betöltése nem sikerült.',
      pool_transfer: {
        coop: 'Tojás készlet átvezetés (ól) — %{organization} → Tyúktartás (%{amount} db)',
        parent:
          'Tojás készlet átvezetés (Tyúktartás) — %{organization} (%{amount} db)',
      },
      description: {
        egg: 'Napi tojás — %{organization}: %{amount} db',
        egg_distribution_internal:
          'Tojás továbbosztás (belső) — %{member}: %{amount} db',
        egg_distribution_sale_egg:
          'Tojás eladás (tojás) — %{member}: %{amount} db',
        egg_distribution_cash:
          'Tojás eladás (kp befizetés) — %{member}: %{amount} db → %{revenue} Ft',
        egg_distribution_revenue:
          'Tojás eladás (bevétel) — %{member}: %{amount} db → %{revenue} Ft',
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
    converted: {
      none: 'Nincs (kifejthető)',
      expanded: 'Kifejtett tétel',
      storno: 'Storno',
      original: 'Eredeti (forrás)',
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
        entryId: 'ID',
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
        converted_to_workflow: 'Ügylet bontás',
        receipt: 'Bizonylat',
        related_group: 'Kapcsolt tranzakciók',
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
