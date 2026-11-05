# Cloud agent prompt: draft tranzakció törlése (editor review)

Másold be a felhő agentnek a **Feladat** szekciótól a végéig (vagy az egész fájlt). Branchen dolgozz; ne force-pusholj; ne commitolj secretet.

## Feladat

Az `editor` a draft tranzakció megtekintésén (`TransactionReviewEditor` / Véglegesítés blokk) tudjon **piszkozatot törölni**: megerősítés után a draft tranzakció és a kapcsolt **draft** bizonylatok véglegesen törlődnek. Published soha. Bulk delete nincs. A `dataentry` show-n nincs törlés gomb.

Ez **implementáló** feladat: backend guarded discard, SPA gomb + Confirm, i18n, tesztek, **és a vonatkozó MD dokumentáció frissítése** (PRD, skill, cursor rule). Ne bővítsd a v1 scope-ot §8 / v2 irányba.

## Miért

A `publisher_must_differ` miatt a saját rögzítésű draftot a rögzítő nem véglegesítheti; a PRD v1 „visszautasítás” eddig csak annyi volt, hogy a QA nem publishol. Beragadt / hibás piszkozatoknak kell escape hatch. A Users & Permissions mátrix ma **szándékosan nem ad `delete` jogot** (`src/index.ts` → `CONTENT_ROLE_ACTIONS`, komment: *no delete*). Ne kapcsold be a nyers CRUD `DELETE`-et minden tranzakcióra.

## Kötelező döntések (ne kérdezz újra)

| Döntés | Érték |
| ------ | ----- |
| Hol | `TransactionFinalizeSection` mellett / ugyanabban a Véglegesítés fieldsetben, másodlagos `color="error"` / `outlined` gomb |
| Láthatóság | csak `editor` + `status === 'draft'` (Review Editor út) |
| Same-person | a publish tiltás **ne** tiltsa a törlést |
| Confirm | react-admin `Confirm` (mint leave / convert); szöveg: tranzakció + csatolt bizonylatok törlődnek |
| Siker után | navigálj a listára (`/transactions` vagy a draft szűrős ellenőrzés listára — konzisztensen a meglévő redirect mintával) |
| Backend | **dedikált** discard művelet (convert mintájára), ne nyers `api::transaction.transaction.delete` jog mindenkinek |
| Cascade | draft tranzakció + kapcsolt draft receipt-ek; lehetőleg a feltöltött media is; published receipt/tranzakció → 403 |
| Convert / storno | ha a rekord még draft és nincs published gyerek-lánc kötelezettség, törölhető; published / nem-draft → elutasít |
| Lista / bulk | nincs |
| dataentry | nincs UI, nincs discard API jog (csak editor) |
| Nyelv | gomb: **Piszkozat törlése** (ne „számla”); `hu` + `en` i18n |

## Kontextus (repo)

- Szerződés: `docs/prd/0001-content-backoffice-v1.md` (§4–§6, §9–§12). ADR: `docs/adr/0001-react-admin-content-ui.md`.
- Scope rule: `.cursor/rules/backoffice-v1-scope.mdc`, SPA: `.cursor/rules/content-backoffice-spa.mdc`, publish: `.cursor/rules/strapi-publish-guard.mdc`.
- Skillek: `.cursor/skills/content-backoffice-spa/SKILL.md`, `.cursor/skills/strapi-publish-guard/SKILL.md`, tesztek: `frontend-testing` / `backend-testing`.
- SPA: `apps/content-backoffice` — Review: `src/pages/transactions/TransactionReviewEditor.tsx`, finalize: `TransactionFinalizeSection.tsx`.
- Jogmátrix / bootstrap: `src/index.ts` (`CONTENT_ROLE_ACTIONS`, `EDITOR_ONLY_CONTENT_ACTIONS`).
- Convert minta (priviledged API, nem nyers delete jog a kliensnek): `src/api/transaction-workflow/routes/convert.ts`, `src/transaction-workflow/convert-service.ts`.
- `withDocumentId` már wrapeli a dataProvider `delete`-et — **ne** erre építs publikus CRUD delete-et editoroknak; a discard legyen saját endpoint + thin SPA helper (mint `publishTransaction` / convert).

## Implementációs irány

### A) Backend

1. Új Content API action, pl. `discardDraft` a transaction (vagy kis backoffice) controlleren:
   - route pl. `POST /api/transactions/:documentId/discard-draft` (vagy a repo meglévő namingjéhez igazítva),
   - scope: `api::transaction.transaction.discardDraft` (vagy egyenértékű),
   - csak **editor** kapja meg (`EDITOR_ONLY_CONTENT_ACTIONS` + role permission sync a bootstrapban).
2. Szerverellenőrzés:
   - Content JWT, editor role,
   - a dokumentum létezik és **draft**,
   - töröld a kapcsolt draft receipt-eket (és media, ha a meglévő upload/receipt minták engedi biztonságosan),
   - töröld a draft tranzakciót,
   - published / hiányzó / nem editor → egyértelmű 403/404 hibaüzenet (SPA `strapiErrorMessage` kompatibilis).
3. **Ne** add hozzá a `delete`-et a közös `CONTENT_ROLE_ACTIONS` listához.
4. Unit tesztek `node:test` + fake doubles (`backend-testing` skill): happy path, published elutasít, dataentry/nem-editor elutasít, receipt cascade.

### B) SPA

1. Data helper: pl. `discardTransactionDraft(documentId)` a `dataProvider` / publish helper mellé (JWT-s fetch, mint finalize).
2. UI: gomb a finalize szekcióban + `Confirm`; loading/disabled finalize közben; siker → notify + lista redirect; hiba → notify.
3. i18n kulcsok `hu.ts` / `en.ts` (title, body, confirm, gomb, success, error).
4. Tesztek a meglévő minták szerint (Vitest logic és/vagy RTL, ha a finalize szekcióhoz van UI teszt).

### C) Dokumentáció (kötelező frissítés)

Frissítsd konzisztensen — a kód és az MD ne mondjon ellentet:

1. **`docs/prd/0001-content-backoffice-v1.md`**
   - §4 / §5.2: editor + draft megtekintésen **Piszkozat törlése** (Confirm, cascade draft receipt).
   - Szereptábla: editor tud discardot; dataentry nem.
   - §5.2 megjegyzés: ez a v1 escape hatch a „nem véglegesít” mellé; részletes QA visszautasítás + kötelező megjegyzés továbbra is v2.
   - §10: új user story + acceptance (editor töröl draftot; published nem; same-person is törölhet; dataentry nem látja; API elutasítja a nem-draftot).
   - §12 DoD: pipa / checklist sor a discardra, ha a többi DoD stílusához illik.
2. **`.cursor/skills/content-backoffice-spa/SKILL.md`** — review tábla / oldalak: discard gomb szabályai.
3. **`.cursor/skills/strapi-publish-guard/SKILL.md`** (+ ha kell a rule): jogmátrix: továbbra sincs általános `delete`; van editor-only `discardDraft`; draft-only + receipt cascade.
4. **`.cursor/rules/content-backoffice-spa.mdc`** és/vagy **`strapi-publish-guard.mdc`**: egy-egy mondat a discardról, hogy az agentek ne „felejtsék”.
5. Opcionális: rövid megjegyzés az ADR-ben csak ha provider-határ változik; különben ne írj új ADR-t.

Ne írj v2 PRD-t. Ne nyiss §8 scope-ot.

## Elfogadás (kész, ha)

- [ ] Editor draft show-n van **Piszkozat törlése** + Confirm
- [ ] Sikeres törlés után a rekord nincs a listán; kapcsolt draft receipt sincs
- [ ] Published show-n / dataentry show-n nincs gomb
- [ ] Same-person draft törölhető (finalize továbbra is tiltott)
- [ ] API: nem-editor és published → elutasít; nyers általános transaction `delete` jog nincs a content role-okon
- [ ] `npm test` (gyökér) és `apps/content-backoffice` tesztek zöldek a változott részekre
- [ ] PRD §10 story + skill/rule MD frissítve
- [ ] Nincs secret a commitban; force-push nincs

## Scope tiltás

- Nincs lista bulk delete, soft-delete / archive UI, kötelező QA megjegyzés (v2), receipt külön törlése publisheden, org/member CRUD (§8).
- Ne refaktoráld a convert pipeline-t, hacsak a discard nem ütközik vele; ütközésnél draft-only discard maradjon, convert viselkedés ne romoljon.

## Munkamódszer

1. Olvasd el a fenti MD-ket és a `TransactionFinalizeSection` / `src/index.ts` / convert route mintát.
2. Először failing backend (+ ha van minta, SPA) teszt, aztán implementáció.
3. MD frissítés ugyanabban a PR-ban, mint a kód.
4. Rövid összefoglaló a PR bodyban: endpoint, UI, story szám / § hivatkozás.
