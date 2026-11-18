# Implementation plan: Hangalapú tranzakció-rögzítés

**Status:** első slice kész (review alatt)
**Date:** 2026-11-18
**Kapcsolódó:** [PRD 0002 — Content Backoffice v2](../prd/0002-content-backoffice-v2.md), [Ügyletek](../transaction-workflow.md), [org-scope middleware](../../src/org-scope-middleware.ts)
**Érintett kód:** új [`src/voice-transaction/`](../../src/voice-transaction/), [`routes/parse-voice.ts`](../../src/api/transaction/routes/parse-voice.ts), [`controllers/transaction.ts`](../../src/api/transaction/controllers/transaction.ts), [`content-roles.ts`](../../src/content-roles.ts), SPA [`VoiceTransactionEntry.tsx`](../../apps/content-backoffice/src/pages/transactions/VoiceTransactionEntry.tsx), [`data/voiceTransaction.ts`](../../apps/content-backoffice/src/data/voiceTransaction.ts)

A felhasználó magyarul lediktálja a tranzakciót a `/#/transactions/create` oldalon; az űrlap kitöltődik, a felhasználó ellenőriz és a szokásos **Mentés** gombbal ment. **Automatikus mentés nincs.**

---

## 1. Folyamat

1. **SPA:** mikrofon gomb a Create űrlap tetején (Web Speech API, `hu-HU`, élő interim szöveg). Ha a böngésző nem támogatja: magyar fallback üzenet, az űrlap kézzel tölthető.
2. **SPA → Strapi:** a végső átirat `POST /api/transactions/parse-voice` `{ transcript, organizationId }` a meglévő JWT-vel (Google OAuth). Új login nincs.
3. **Strapi:** auth → feature flag → szerepkör → rate limit → org-hozzáférés → kontextus → LLM → szerveroldali validálás → válasz. Írás nincs.
4. **SPA:** `setValue` a mezőkre, kiemelés (zöld = kitöltve, narancs = bizonytalan), figyelmeztetések; mentés a meglévő logikával és workflow-kkal, változatlanul.

## 2. Backend

| Elem           | Döntés                                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route          | `POST /transactions/parse-voice`, scope `api::transaction.transaction.parseVoice` (minden content role: dataentry, editor, controller)                                     |
| Feature flag   | Settings sor `voice_transaction_entry` (`enabled`, opcionális `config.roles`). Edizone és KOR seedben bekapcsolva. Kikapcsolva: 403, SPA gomb rejtve                       |
| Org-hozzáférés | dataentry / editor: csak a saját M2M szervezetek; controller: minden szervezet. Idegen `organizationId` → 403 még az LLM hívás előtt                                       |
| Kontextus      | elérhető szervezetek, számlák (kód + név), pénznemek, tagok, publikált ügylet-sablonok. Egy sablon `configuration.feature` mezője kikapcsolt feature sorra mutatva kimarad |
| LLM            | `LlmJsonClient` interfész (`llm.ts`), provider adapter `llm-anthropic.ts`, választás `LLM_PROVIDER` alapján. Strict JSON schema (structured output). Kulcs csak szerveren  |
| Validálás      | minden ID-nak a kontextusban kell lennie; különben `null` + magyar figyelmeztetés. Dátum `YYYY-MM-DD`, összeg > 0, azonos tartozik/követel számla elutasítva               |
| KÖR kincstár   | `1100` csak kifejezett diktálásra (kód, „kincstár” vagy a számla neve). Promptban és szerveroldali őrként is                                                               |
| Rate limit     | in-memory, felhasználónként (`VOICE_PARSE_RATE_LIMIT` / `VOICE_PARSE_RATE_WINDOW_SECONDS`, alap 10 / 60 s). Egy Strapi processzre érvényes                                 |
| Naplózás       | csak átirat-hossz, kimenet, státusz, időtartam; nyers átirat soha. Az audit log alap redact listája kiegészül a `transcript` kulccsal                                      |

Válasz: `{ date, amount, currency_type, debit_account, credit_account, organization, member, workflow, description, confidence, low_confidence_fields[], warnings[], labels }` — az ID-k Strapi `documentId`-k.

## 3. SPA

- `VoiceTransactionEntry` a `SimpleForm`-on belül; a feature flag a `/api/backoffice/config` `features` mapjából jön.
- `mapVoiceParseToForm` (tiszta függvény, tesztelt): `null` sosem töröl kézi értéket. Ügylet-sablont csak akkor választ, ha nem volt meg mindkét számla; ilyenkor a pénznem / számlák a sablon prefill **után**, csak üres mezőbe íródnak.
- A tag (member) csak információ: a tranzakciónak nincs tag mezője.
- Teljes bizalom < 0,6 → minden kitöltött mező „bizonytalan”.

## 4. Env

`.env.example`: `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT_MS`, `VOICE_PARSE_RATE_LIMIT`, `VOICE_PARSE_RATE_WINDOW_SECONDS`. Kulcs nélkül az endpoint 503-at ad.

## 5. Tesztek

- Backend (`src/voice-transaction/service.test.ts`, fake Strapi + mock LLM): érvényes kimenet, ismeretlen ID-k, idegen szervezet, controller, KÖR kincstár őr, auth / flag / LLM hiány, LLM hiba, rate limit, naplóban nincs átirat.
- SPA (Vitest): `voiceTransaction.test.ts` (válasz → űrlapérték leképezés), `useSpeechRecognition.test.ts`.

## 6. Nem-cél / később

- Szerveroldali hangfeldolgozás (a böngésző végzi a felismerést).
- Megosztott (Redis) rate limit több processz esetén.
- Tag-mező a tranzakción; Edit / Review oldali diktálás.
- Playwright smoke a mikrofon gombra (Web Speech API mock kell hozzá).
