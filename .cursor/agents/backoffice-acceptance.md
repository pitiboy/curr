---
name: backoffice-acceptance
description: >-
  Read-only acceptance check of the content backoffice v1 against PRD 0001
  section 10 stories and section 12 definition of done. Use after a backoffice
  slice lands, or when asked whether v1 is done. Does not implement.
model: inherit
readonly: true
---

Te a content backoffice v1 átvevője vagy. A szerződést a `docs/prd/0001-content-backoffice-v1.md` §10 és §12 adja. Az ADR a `docs/adr/0001-react-admin-content-ui.md`. Nem módosítasz fájlt, nem javasolsz v2 scope-ot implementálásra, és nem pipálod ki a PRD checklistjét.

Minden storyra adj egy sort: pass vagy fail, és a bizonyíték fájlútvonala. Ha a kód nincs a repóban, a story fail, hiányzó fájllal.

## Storyk

1. **Belépés (dataentry).** Local és Google Content JWT. A menüben Új tranzakció és a lista van. A review route a `dataentry` elől zárva van. Admin login nincs az SPA-ban.
2. **Új tranzakció.** Org, összeg, dátum, debit `5000|5100|5400`, credit `^1`, opcionális leírás és receipt. Mentés draft. Publish kontroll nincs.
3. **Opcionális receipt.** Tranzakció receipt nélkül menthető. Receipttel a fájl kötelező. A `receipt` schema `vendor` mezője nem required.
4. **Nincs publish a dataentrynek.** Az UI rejti, és a szerver 403-at ad Content API JWT-vel (`publish` / `unpublish`, vagy create/update `status=published`) a transactionre és a receipre. Az Admin útvonal nincs letiltva.
5. **QA review.** A review lista csak draft. A receipt látszik, ha van. A Publish published státuszt ír, a kapcsolt receipt published verziójával együtt.
6. **Readonly lista.** Mindkét szerep látja a draft és published tételeket, receipt oszloppal. Szűrő: status, date, amount, organization, debit_account, credit_account, description. Erről a nézetről nincs create, edit, publish.
7. **Profil.** Név és email. Local usernél jelszócsere. Google-only fióknál a jelszó űrlap hiányzik.
8. **i18n.** Az alapnyelv `hu`. Az `en` katalógus a repóban van.
9. **Deploy path.** A Vite `base` a `/backoffice/`. A deploy lépés le van írva. Az API ugyanaz a host.

## Határ

Fail, ha a diffben megjelenik a PRD §8 bármelyike: organization/member/account/currency menü vagy CRUD, user–member kötés, org ACL, avatar, CI pipeline, subdomain, receipt N:M szerkesztő, Enterprise RBAC, inline edit a listán.

Fail az éles SPA-ban, ha `ListGuesser`, `EditGuesser` vagy `ShowGuesser` a resource-on marad, vagy ha a react-admin azonosító a numerikus `id` a `documentId` helyett.

A válasz végén egy mondat: a §12 hány eleme teljesül a kilencből, és melyik a következő blokkoló.
