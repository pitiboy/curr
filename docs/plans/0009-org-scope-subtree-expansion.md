# Org-scope: szervezeti fa (subtree) kiterjesztés — opciók

**Status:** research only — egyelőre **nem** implementáljuk  
**Date:** 2026-11-10  
**Kapcsolódó:** [org-scoping middleware prompt](../prompts/org-scoping-middleware.md), User↔Organization M2M (`src/extensions/users-permissions/.../user/schema.json`), [`src/org-scope-middleware.ts`](../../src/org-scope-middleware.ts), organization `parent` / `children` ([`schema.json`](../../src/api/organization/content-types/organization/schema.json))  
**Seed referencia (Kor):** `database/seeders/http/kor/data/organizations.json` — ~40 org, max mélység a roottól **5** (pl. `Tojóól`)

A Content API org-szűrés ma **pontos M2M tagságra** megy: a userhez kötött szervezetek `documentId` listája kerül `$in` filterbe (és create/update allow-listbe). A szervezeti fa miatt egy szülőhöz kötés **nem** ad hozzáférést a gyerekekhez — adminban minden releváns levelet / ágat külön fel kell venni. Ez a dokumentum a subtree-kiterjesztés opcióit hasonlítja össze; döntés és kód később.

---

## 1. Cél és nem-cél

### Cél (ha egyszer megvalósul)

- Egy (vagy néhány) kiválasztott szervezethez kötött `dataentry` / `editor` user a **szülő + leszármazottak** tranzakcióit / bizonylatait / szervezetlistáját is lássa (és oda írjon), a meglévő Document Service org-scope keretben.
- Adminban ne kelljen a teljes részfát manuálisan felvenni az M2M-be.

### Nem-cél (most)

- Implementáció, séma-migráció, Admin custom field.
- SPA RoleGuard / menüváltozás.
- `membership` / egg `rules` átalakítás.
- External PDP / Permit.io.

### Nyitott szemantika (döntés implementáció előtt)

| Kérdés                                   | Tipikus válasz Currhez                                             |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Membership = szülő **+** leszármazottak? | Igen (szülő is a scope-ban).                                       |
| Create / update a leszármazott orgra?    | Igen — ha olvashatja, írhatja is.                                  |
| Mélységkorlát (`maxDepth`)?              | Alapból **végtelen** (teljes subtree); limit csak üzleti indokkal. |
| Több M2M org?                            | Unió a kibővített halmazokból (mai multi-org viselkedés).          |

---

## 2. Mai állapot (baseline)

| Réteg      | Viselkedés                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| Admin      | OOTB Content Manager multi-select: User → `organizations`, Organization → `content_users`. Nincs „include children”. |
| Middleware | `loadUserOrgDocumentIds` → exact IDs → `mergeScopedFilter` / create–update allow-list.                               |
| Bypass     | `controller` role: nincs org filter.                                                                                 |
| Fa         | `organization.parent` / `children` self-relation; nincs path / closure tábla.                                        |

A filter injektálás (`$in` + `$and` merge) **maradhat**; a kérdés az, **honnan** jön a megengedett ID-halmaz, és kell-e Admin / séma változás.

---

## 3. Opciók

### A — Request-time descendant expansion (ajánlott)

Requestenként (vagy request-cache-elve): a user M2M orgjai után BFS/DFS a `parent`/`children` éleken → bővített ID-lista → a meglévő `$in` filter és write-check.

- `maxDepth: Infinity` (vagy szám) egy paraméter; depth=2 és végtelen **ugyanaz a kódút**.
- Fa betöltés: egy `findMany` (documentId + parent), memóriában járás — Kor méretnél elhanyagolható.
- Admin változatlan: elég a szülőt kötni.

### B — Assignment-kori M2M felbontás (silent vagy Admin UX)

Mentéskor (lifecycle / Document Service) a kiválasztott orgok leszármazottait is beírni a join táblába. Middleware változatlan.

- **B1:** silent server expand (UI meglepetés: 1 kiválasztás → N mentett kapcsolat).
- **B2:** Admin custom field / CM injection („include children”) — Strapi 5-ben közepesen–nehéz, upgrade-érzékeny; a projekt eddig kerüli (lásd org-scoping prompt: nincs injection / DOM hack).

Hátrány mindkettőnél: új gyerek org vagy parent-mozgatás **nem** frissíti a régi joinokat.

### C — Nested Strapi filter (fixált mélység)

Filter alakban pl. depth=2:

```ts
organization: {
  $or: [
    { documentId: { $in: roots } },
    { parent: { documentId: { $in: roots } } },
    { parent: { parent: { documentId: { $in: roots } } } },
  ],
}
```

Create/update-hoz **úgyis** kell expanded ID-lista → dupla logika. Unlimited mélység gyakorlatilag lehetetlen. Kor max depth 5-nél a nested `$or` törékeny.

### D — Materialized path vagy closure table

Séma: pl. `path = /rootId/…/selfId`, vagy ancestor–descendant closure. Filter: path prefix / join. Parent-move sync kötelező.

Skálára jó; ~40 orgnál prematúr a mai middleware-hez képest.

---

## 4. Rangsor (Currhez)

| Rang  | Opció                          | Rövid indok                                                                                                   |
| ----- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **1** | **A — request-time expansion** | Kis diff a meglévő middleware-hez; Admin OOTB marad; fa változás azonnal érvényes; Kor méretnél perf rendben. |
| 2     | D — path / closure             | Csak akkor, ha a fa később nagyságrenddel nő, vagy SQL-szinten kell prefix szűrés.                            |
| 3     | B1 — silent assignment expand  | Middleware érintetlen, de elavuló join + zavaró CM lista.                                                     |
| 4     | B2 — Admin UX + expand         | Drága Strapi Admin munka, ugyanaz a stale-membership gond.                                                    |
| 5     | C — nested filter              | Fixed depth, törékeny, write-path külön.                                                                      |

**Ajánlás most:** dokumentálva tartani az **A**-t mint későbbi implementációs irányt; **ne** kezdjük B2/C-vel. Depth limit default: teljes subtree (`Infinity`).

---

## 5. Összehasonlító táblák

Jelölés: **1** = legjobb a projekthez ebben a dimenzióban, **5** = legrosszabb. (Relatív rang az öt változat között; B1/B2 külön sor.)

### 5.1 Összkép

| Szempont                        | A request-time           | B1 silent M2M     | B2 Admin+M2M | C nested filter     | D path/closure           |
| ------------------------------- | ------------------------ | ----------------- | ------------ | ------------------- | ------------------------ |
| Illeszkedés a mai middlewarehez | kiváló                   | kiváló (noop)     | jó           | gyenge              | közepes (új mező + sync) |
| Admin munka                     | nincs                    | nincs             | jelentős     | nincs               | nincs / kevés            |
| Fa átrendezés után helyes scope | igen (következő request) | nem (stale)       | nem (stale)  | igen (olvasás)      | igen (ha sync OK)        |
| Becsült első megvalósítás       | ~0.5–1 nap + tesztek     | ~0.5 nap + quirks | több nap     | ~1 nap, korlátozott | több nap + migráció      |
| Ajánlott Currben most?          | **igen (később)**        | inkább ne         | nem          | nem                 | később, ha kell          |

### 5.2 UI (Strapi Admin + érintett felületek)

|                                          | A                     | B1                                               | B2                            | C           | D           |
| ---------------------------------------- | --------------------- | ------------------------------------------------ | ----------------------------- | ----------- | ----------- |
| Content Manager relation UI              | változatlan OOTB      | változatlan, de mentés után „szétrobban” a lista | új/custom mező vagy injection | változatlan | változatlan |
| „Egy szülő = egész ág” láthatóság a UI-n | implicit (middleware) | hamis (sok explicit link)                        | explicit checkbox / fa        | implicit    | implicit    |
| Content-backoffice SPA változás          | nem kell              | nem kell                                         | nem kell                      | nem kell    | nem kell    |
| Strapi 5 CM tweak nehézség               | —                     | —                                                | magas                         | —           | —           |
| **UI rang**                              | **1**                 | 3                                                | 4                             | 2           | 2           |

### 5.3 UX (szerkesztő / adatrögzítő / adminisztrátor)

|                                      | A                                           | B1                             | B2                              | C                                 | D                            |
| ------------------------------------ | ------------------------------------------- | ------------------------------ | ------------------------------- | --------------------------------- | ---------------------------- |
| Admin: kevés org-kötés               | igen                                        | igen (input), nem (tárolt kép) | igen, ha jól van megcsinálva    | igen                              | igen                         |
| Meglepetésmentes mentés              | igen                                        | nem (1 → N kapcsolat)          | jobb, ha van „include children” | igen                              | igen                         |
| Új gyerek org megjelenik a scope-ban | automatikus                                 | manuális / újra-mentés         | manuális / újra-mentés          | automatikus                       | automatikus (path sync után) |
| Scope visszavonása (szülő levétele)  | egyértelmű                                  | nehéz (sok leaf törlése)       | közepes                         | egyértelmű                        | egyértelmű                   |
| depth=2 vs teljes fa                 | paraméter; Korban depth=2 gyakran **kevés** | ugyanez                        | ugyanez                         | depth=2 „könnyebb”, unlimited nem | unlimited természetes        |
| **UX rang**                          | **1**                                       | 4                              | 2                               | 3                                 | 1–2                          |

### 5.4 DX (fejlesztői élmény, karbantartás, teszt)

|                     | A                                             | B1                                                       | B2                         | C                                       | D                                |
| ------------------- | --------------------------------------------- | -------------------------------------------------------- | -------------------------- | --------------------------------------- | -------------------------------- |
| Érintett mag        | `loadUserOrgDocumentIds` (+ helper + tesztek) | U&P lifecycle / Document Service; mindkét relation oldal | + Admin plugin / injection | filter builder + külön write allow-list | séma, migráció, parent-move hook |
| U&P Strapi 5 quirks | kevés (már bejárva)                           | magas (user relation hooks)                              | magas + Admin API          | közepes                                 | közepes                          |
| Tesztelhetőség      | unit + meglévő chain tesztek bővíthetők       | lifecycle fake-ek                                        | E2E Admin is kellene       | nested filter regresszió                | migráció + sync tesztek          |
| Upgrade kockázat    | alacsony                                      | közepes                                                  | magas (CM internals)       | közepes                                 | közepes                          |
| **DX rang**         | **1**                                         | 3                                                        | 5                          | 4                                       | 3                                |

### 5.5 Production teljesítmény

Feltétel: Kor-szerű fa (**~40** org, mélység ≤ **5**), scoped requestenként egyszeri expansion, `dataentry`/`editor` forgalom.

|                               | A                                              | B1                            | B2      | C                       | D                                  |
| ----------------------------- | ---------------------------------------------- | ----------------------------- | ------- | ----------------------- | ---------------------------------- |
| Extra munka / scoped request  | 1× org lista (vagy cache) + memória-BFS        | nincs (join már bő)           | mint B1 | nested join-ok a DB-ben | path prefix / closure join — olcsó |
| Extra munka / user-org mentés | nincs                                          | subtree walk + nagy M2M write | mint B1 | nincs                   | path újraszámolás parent-move-nál  |
| Skálázás 10³+ orgra           | requestenként teljes fa töltés drágábbá válhat | join tábla duzzad             | mint B1 | rossz                   | **jó**                             |
| Mai production kockázat       | elhanyagolható                                 | alacsony CPU, nagyobb join    | mint B1 | felesleges komplexitás  | overkill                           |
| **Perf rang (mai méret)**     | **1**                                          | 1                             | 1       | 3                       | 2 (fölös költség)                  |
| **Perf rang (jövő, nagy fa)** | 3                                              | 2                             | 2       | 5                       | **1**                              |

**depth=2 vs végtelen (A opció):** azonos komplexitású kód; Korban a végtelen subtree a helyes default. A depth=2 csak akkor „könnyebb”, ha C-szerű nested filterrel próbálkozunk — azt Currben nem érdemes.

---

## 6. Ajánlott későbbi implementációs vázlat (A)

Csak irány, nem feladatlista a mostani sprinthoz:

1. Helper: `expandOrgDocumentIds(roots, { maxDepth })` — adjacency a parent élekből, ciklusvédelem.
2. `loadUserOrgDocumentIds` után hívás; create/update ugyanarra a bővített setre.
3. Request-local memo (ugyanarra a userre ne járjuk kétszer).
4. Tesztek: szülő tagság → unoka trx látszik; idegen ág tiltva; multi-root unió; controller bypass; organization self-filter.
5. Opcionális konstans / config: `ORG_SCOPE_MAX_DEPTH` (default `Infinity`).

Nem kell: Admin injection, path mező, assignment-kori join felduzzasztás.

---

## 7. Döntés napló

| Dátum      | Döntés                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-10 | Opciók dokumentálva; **implementáció elhalasztva**. Preferált irány: **A (request-time expansion)**, default teljes subtree. |
