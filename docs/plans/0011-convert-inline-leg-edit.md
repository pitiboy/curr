# 0011 — Kifejtés előnézet: inline lépésszerkesztés

**Issue:** [#106](https://github.com/pitiboy/curr/issues/106)

## Összefoglaló

A Kifejtés megerősítő (és előnézet) párbeszédablakban az `editor` / `controller` **Kifejtés szerkesztése** gombbal átkapcsolható szerkesztő mód: a generált lépéssorok inline módosíthatók, törölhetők, másolhatók; új lépés adható. **Mégse** visszaállítja a `convert-preview` alapján generált sorokat (szerkesztő módban marad). **Mentés** csak a kliens oldalon rögzíti az overrides payloadot; a tényleges DB írás a meglévő **Kifejtés** gombnál történik.

Az eredeti és a storno sor (ha van) read-only. A sablon (`transaction-workflow`) nem változik.

## Backend

- `POST /api/transaction-workflows/convert` opcionális `overrides.legs[]` — validálás: `resolveCustomisedStepRows` (`convert-overrides.ts`).
- Egyedi kifejtés jelölése: step leírás végén `[egyedi kifejtés]`.
- Dupla kifejtés: DB `updateMany` claim (`converted_to_workflow: original`) + 409 `TRANSACTION_ALREADY_CONVERTED` („A tranzakció már ki van fejtve.”). Batch convert: `failures[]` tömb a válaszban.
- `dataentry`: convert API továbbra is tiltott; overrides esetén extra 403.

## Frontend

- Feature flag: `convert_inline_edit` (edizone + kor seed).
- Csak **egyedi** kifejtés gomb flow (bulk változatlan).
- Validáció: kötelező számlák, debit ≠ credit, pozitív összeg; százalék ↔ összeg szinkron (HUF egész).
- 409: magyar üzenet + lista frissítés.

## Teszt / manuális

1. Editor: Kifejtés → előnézet → Kifejtés szerkesztése → összeg/számla módosítás → Mentés → Kifejtés.
2. Dupla kattintás / párhuzamos kifejtés: egy siker, egy 409.
3. `dataentry`: nincs szerkesztő gomb; API overrides 403.
