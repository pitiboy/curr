```
/impeccable design
Operate mód. Code-led. React Admin 5 + meglévő content-backoffice design.
Feladat: új kimutatás aloldal a backoffice-ban.
---
[IDE ILLIK A PÁR SOROS DEFINÍCIÓD]
pl. Heti tojásforgalom dashboard: mennyiség idősor, account-code bontás,
top vendorok, üres/loading/error állapot. dataentry olvashat, editor is.
---
Korlátok:
- Maradj a meglévő RA/MUI mintáknál; ne marketing hero / landing layout.
- Egy elsődleges kérdésre válaszoljon az oldal; a chartok a döntést szolgálják.
- Szín csak az adaton (sorozatok/állapot), ne dekoráción.
- Magyar UI szövegek.
- Először shape/brief, majd implementáld a skeleton + mock adatokkal;
  valós API-t csak ha egyértelmű a forrás.
Ha még nincs PRODUCT.md / DESIGN.md: init/document nélkül is menj tovább,
Operate + meglévő RA komponensek alapján.
```

# Ha már van skeleton és csak szépíteni akarod:

```
/impeccable polish apps/content-backoffice/.../DashboardPage
Operate. Tartsd a layoutot és az adatstruktúrát.
Javítsd: hierarchy, számok igazítása, chart legend/tooltip, empty/loading,
AI-slop (stat-chip soup, card-in-card, felesleges gradient).
Ne cseréld le a chart libet.
```

# Ha még nem tudod a layoutot, csak a briefet:

```
/impeccable shape
Operate dashboard brief a következő kimutatáshoz:
---
[DEFINÍCIÓ]
---
Output: 1 oldal brief — users, primary question, KPI-k, chartok, states, RA route hint.
Ne implementálj még.
```
