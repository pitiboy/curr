# PRD — Kameruni juh költségterv és dashboard

> **Projekt kód:** `kameruni-juh`
> **Típus:** Állattenyésztési projekt költségterv (Cost Plan + Dashboard)
> **Platform:** Jupyter Notebook (önálló, parametrizált)
> **Nyelv:** Magyar (UI, dokumentáció, változónevek lehetnek angolul)
> **Verzió:** 0.1.0 — kezdeti tervezet
> **Készült:** 2026-05-20

---

## 1. Bevezető

Ez a dokumentum a CURR/KÖR (Community Unified Resource Registry / Közösségi Önjegyző Render) workspace első **projekt-szintű költségterv** modulját írja le. A cél egy **újrafelhasználható, projektenként klónozható Jupyter Notebook sablon**, amelyben a felhasználó interaktívan tud teljes életciklus-költségvetést és bevételi forgatókönyveket modellezni egy adott projektre.

Az első konkrét megvalósítás egy **kameruni juh (Ovis aries — Cameroon dwarf sheep) tenyésztési projekt** költségterve. Ez egyben a sablon validálása is: ami itt jól működik, az lesz a `projects/<projekt-kód>/` mappa-konvenció alapja.

### 1.1 Mi a kameruni juh?

A kameruni juh egy **kis testű, szőrös (nem gyapjas), igénytelen** afrikai eredetű juhfajta, amely jól bírja a változékony időjárást, kis területen tartható, és elsősorban **húshasznú** célokra (vagy hobbiállatként, parkfenntartásra) használják. Magyarországon hobbi- és közösségi gazdaságokban népszerű, mert:

- 35–45 kg felnőtt élősúly (kos), 25–35 kg (anyajuh) — kevés takarmány
- Évente 1–2 ellés, ellésenként **1–3 bárány** (jellemzően ikrek)
- Egész évben legel, télen minimális kiegészítő takarmány
- Betegségekkel szemben ellenálló
- Bárányhús kereslete prémium-szegmensben stabil

---

## 2. Célok és sikerkritériumok

### 2.1 Üzleti célok

| # | Cél | Mérőszám |
|---|---|---|
| C1 | A projekt **pénzügyi életképességének** előzetes validálása döntés előtt | NPV, IRR, megtérülési idő ki van számolva minden szcenárióra |
| C2 | **CAPEX vs. OPEX vs. Bevétel** forgatókönyvek összehasonlítása egy felületen | 3+ szcenárió egymás mellett, kapcsolóval váltható |
| C3 | **Érzékenységvizsgálat** kritikus változókra (húsár, takarmányár, mortalitás) | Tornado-diagram min. 6 változóra |
| C4 | Eredmények **Excel/CSV/PDF exportja** közösségi döntéshozatalhoz | Egy gombnyomásra exportálható összefoglaló |
| C5 | A notebook **újrafelhasználható sablon** legyen más projektekhez (méhészet, kecske, kertészet stb.) | Projekt-specifikus paraméterek külön YAML/JSON fájlban |

### 2.2 Sikerkritériumok (Definition of Done)

- [ ] A notebook **end-to-end fut hiba nélkül** Python 3.11+ környezetben.
- [ ] Minden bemeneti paraméter **ipywidgets**-ekkel állítható, élő újraszámolással.
- [ ] A dashboard tartalmaz **legalább 8** különböző vizualizációt (lásd 7.6).
- [ ] Az exportált Excel **3 munkalapot** tartalmaz: `Paraméterek`, `Eredmények`, `Cashflow`.
- [ ] A paraméterek **YAML fájlban** is felülbírálhatók (CLI-szerű futtatáshoz).
- [ ] **Mintaadatokkal** dokumentált bázis-szcenárió mellékelve (`scenarios/baseline.yaml`).

---

## 3. Hatókör

### 3.1 Scope-on belül (in-scope)

- **CAPEX modellezés** — egyszeri beruházások (kerítés, karám, itató, kezdő állomány)
- **OPEX modellezés** — éves működés (takarmány, állatorvos, biztosítás, munkadíj, energia)
- **Bevétel modellezés** — bárányhús, tenyészállat-eladás, trágya, esetleg gyapjú/bőr
- **Cashflow** — éves szintű, 5 (vagy konfigurálható N) éves időhorizontra
- **Pénzügyi mutatók** — NPV, IRR, Payback Period, ROI, Break-even
- **Szcenárió-kezelés** — Optimista / Reális / Pesszimista + tetszőleges egyedi
- **Érzékenységvizsgálat** — egyváltozós szenzitivitás kulcs paraméterekre
- **Dashboard** — interaktív vizualizációk a notebookon belül (plotly + ipywidgets)
- **Export** — Excel (xlsx), CSV, PDF (notebook teljes export)

### 3.2 Scope-on kívül (out-of-scope, későbbi fázis)

- **CURR/KÖR adatbázis integráció** (külön ticket, ld. 13. szakasz)
- **Honline import** (terv vs. tény elemzés) — V2-be
- **Több projekt aggregálása** — külön „portfolio dashboard"
- **Webes UI** (Streamlit / Dash deploy) — a notebook az elsődleges felület
- **Élő adatfrissítés** (takarmányár API-k stb.)
- **Adóügyi és könyvelési** részletek (csak közelítő nettó/bruttó kapcsoló)

---

## 4. Felhasználói perszónák

| Perszóna | Cél | Tudásszint |
|---|---|---|
| **Projektgazda (Pál)** | Eldönteni, hogy a kameruni juh projekt belefér-e az éves keretbe | Excel-középszint, programozás nincs |
| **Pénztáros / Könyvelő (Dani)** | Tervadatot készíteni a tagi gyűlésre, exportálni Excel-be | Excel-erős, Jupyter alapok |
| **Közösségi tag (szavazó)** | Megérteni a 3 szcenáriót egy oldalas összefoglalóból | Laikus |
| **Fejlesztő (kód karbantartó)** | Új projektre átszabni a sablont YAML módosítással | Python-középszint |

---

## 5. Felhasználói történetek (User Stories)

### 5.1 Projektgazda
- **US-01**: Projektgazdaként szeretném **csúszkákkal és input mezőkkel** állítani az alap paramétereket (állatszám, ár, takarmányköltség), hogy azonnal lássam a hatást a megtérülésre.
- **US-02**: Szeretném **3 szcenáriót egymás mellett** látni (optimista / reális / pesszimista) egy összehasonlító táblázatban.
- **US-03**: Szeretnék **Excel exportot** kapni, hogy a tagi gyűlésre kinyomtatható összefoglalót készíthessek.

### 5.2 Pénztáros
- **US-04**: Pénztárosként szeretném a **5 éves cashflow táblát** havi vagy éves bontásban látni.
- **US-05**: Szeretnék **érzékenység-elemzést** látni: ha a húsár 20%-kal esik, mennyivel romlik az IRR?
- **US-06**: Szeretném a terv-paramétereket **YAML fájlban** verziókövetni (`scenarios/2026-q2.yaml`).

### 5.3 Közösségi tag
- **US-07**: Tagként szeretnék **egy oldalas vizuális összefoglalót** kapni PDF-ben, amit a gyűlésen láthatok.

### 5.4 Fejlesztő
- **US-08**: Fejlesztőként szeretném, hogy a notebook **moduláris** legyen — a projekt-specifikus paraméterek és számítások kiszervezve, a vizualizációk újrafelhasználhatók.

---

## 6. Funkcionális követelmények

### 6.1 Paraméter konfiguráció (`F-PARAM`)

| ID | Követelmény |
|---|---|
| F-PARAM-01 | Minden bemeneti paraméter **ipywidgets** elemmel állítható (FloatSlider, IntText, Dropdown). |
| F-PARAM-02 | A paraméterek **csoportokba** rendezve jelennek meg: `Állomány`, `CAPEX`, `Takarmány`, `Állategészségügy`, `Munka`, `Bevétel`, `Pénzügyi feltételezések`. |
| F-PARAM-03 | Bázisértékek **YAML fájlból** töltődnek be (`scenarios/baseline.yaml`). |
| F-PARAM-04 | A widget-állapot **menthető YAML-ba** egy `Mentés` gombbal. |
| F-PARAM-05 | Minden paraméternek van **mértékegysége** (db, Ft, kg, hónap, %) és **rövid leírása** tooltipben. |

### 6.2 CAPEX modul (`F-CAPEX`)

| ID | Követelmény |
|---|---|
| F-CAPEX-01 | Egy **tételes táblázat** (DataFrame): tétel név, mennyiség, egységár, élettartam (év), bekerülési év. |
| F-CAPEX-02 | Alap tételek mintaként előre kitöltve: kerítés, karám, takarmánytároló, itató, kezdő állomány (anyajuhok + tenyészkos), szállítóeszköz. |
| F-CAPEX-03 | Az **értékcsökkenés (amortizáció)** lineárisan számolva, élettartam alapján. |
| F-CAPEX-04 | **Pótló beruházás** automatikusan ütemezve az élettartam végén (opcionális kapcsoló). |

### 6.3 OPEX modul (`F-OPEX`)

| ID | Követelmény |
|---|---|
| F-OPEX-01 | Takarmány: **legelő terület + kiegészítő takarmány** (széna, abrak) éves mennyiség × ár / állat. |
| F-OPEX-02 | Állatorvosi: oltások, féregtelenítés, körmölés (db × ár / állat / év). |
| F-OPEX-03 | Munkaerő: **saját munka óra** és **bérelt munka** külön (a saját idő pénzbeli értékét opcionálisan beszámítja). |
| F-OPEX-04 | Egyéb: biztosítás, energia, eszközfenntartás (átalány). |
| F-OPEX-05 | OPEX **éves indexálása** inflációval (alap: 5%, állítható). |

### 6.4 Bevétel modul (`F-REV`)

| ID | Követelmény |
|---|---|
| F-REV-01 | **Szaporulat számítás**: anyajuhok száma × szaporulati ráta × ikrek aránya × túlélési ráta. |
| F-REV-02 | **Bárányhús**: bárányok száma × élősúly × vágási kihozatal × hús ár (Ft/kg vágott). |
| F-REV-03 | **Tenyészállat eladás**: hány %-a kerül tenyésztésre vissza vs. eladásra, áron. |
| F-REV-04 | **Selejtezett anyajuh** értékesítése (vágási áron). |
| F-REV-05 | **Trágya** (kompostként, kg/év × ár — opcionálisan kikapcsolható). |
| F-REV-06 | **Állomány-növekedés** opciója: a megtermelt teny.állatok visszaforgatása. |

### 6.5 Pénzügyi mutatók (`F-FIN`)

| ID | Követelmény |
|---|---|
| F-FIN-01 | **NPV** (Net Present Value) konfigurálható diszkontrátával. |
| F-FIN-02 | **IRR** (Internal Rate of Return) — numerikus iterációval (scipy.optimize). |
| F-FIN-03 | **Payback Period** — diszkontált és nem diszkontált változat. |
| F-FIN-04 | **Break-even**: hány év / hány bárány kell a fedezeti ponthoz. |
| F-FIN-05 | **ROI** összesített és éves bontásban. |

### 6.6 Dashboard / vizualizáció (`F-DASH`)

A notebook végén egyetlen scroll-olható dashboard, legalább az alábbi elemekkel (plotly interaktív):

| # | Vizualizáció | Adat |
|---|---|---|
| 1 | **KPI kártyák** | NPV, IRR, Payback, Break-even, Össz. CAPEX, Éves OPEX átlag |
| 2 | **Éves cashflow** bar+line | Bevétel, OPEX, Net cashflow, Kumulált cashflow |
| 3 | **Költség-bontás (donut)** | CAPEX vs. OPEX tételek szerint |
| 4 | **Bevétel-bontás (donut)** | Bárányhús / Tenyészállat / Trágya / Egyéb |
| 5 | **Állomány alakulása** (line) | Anyajuhok, kosok, bárányok időben |
| 6 | **Tornado / érzékenység** (horizontal bar) | NPV változás kulcs paraméterekre |
| 7 | **Forgatókönyv összehasonlítás** (grouped bar) | Opt / Reál / Pesszim — NPV és IRR |
| 8 | **Break-even chart** (line) | Kumulált cashflow időben, fedezeti ponttal |

### 6.7 Export (`F-EXP`)

| ID | Követelmény |
|---|---|
| F-EXP-01 | **Excel export** (`openpyxl`) 3 munkalappal: `Paraméterek`, `Eredmények`, `Cashflow`. |
| F-EXP-02 | **CSV export** cashflow táblázathoz. |
| F-EXP-03 | **PDF export** — a notebook `nbconvert`-en keresztül (későbbi fázis). |
| F-EXP-04 | Az export fájlnévben **timestamp és szcenárió neve** szerepel. |

### 6.8 Szcenárió kezelés (`F-SCEN`)

| ID | Követelmény |
|---|---|
| F-SCEN-01 | **3 előre definiált szcenárió** YAML-ban: `optimistic.yaml`, `realistic.yaml`, `pessimistic.yaml`. |
| F-SCEN-02 | A három szcenárió **párhuzamosan számítva**, egymás mellett megjelenítve. |
| F-SCEN-03 | A pesszimista/optimista a reálistól **±X% eltéréssel** generálható automatikusan (X állítható). |

---

## 7. Bemeneti paraméterek (Kameruni juh — alap szcenárió)

> Az alábbi értékek **kiindulási benchmarkok** magyar viszonyokra (2026). A notebook indításakor a felhasználó felülírja őket.

### 7.1 Állomány

| Paraméter | Érték | Egység |
|---|---|---|
| Kezdő anyajuh állomány | 20 | db |
| Kezdő tenyészkos | 1 | db |
| Anyajuh / kos arány | 20:1 | — |
| Anyajuh hasznos élettartam | 6 | év |
| Éves szaporulat (ellésszám / anyajuh) | 1.3 | — |
| Bárány / ellés átlag | 1.6 | db |
| Bárány túlélési ráta (4 hónapig) | 90 | % |
| Felnőttkori mortalitás | 3 | % / év |

### 7.2 CAPEX (egyszeri)

| Tétel | Mennyiség | Egységár (Ft) | Élettartam (év) |
|---|---|---|---|
| Kerítés (drót, 1.2 m) | 800 | 1 500 / fm | 15 |
| Karám / istálló (fedett) | 80 | 35 000 / m² | 25 |
| Itató (önműködő) | 4 | 25 000 | 10 |
| Etető rács | 6 | 18 000 | 10 |
| Takarmánytároló | 1 | 250 000 | 20 |
| Anyajuh (kezdő) | 20 | 45 000 | (állati) |
| Tenyészkos (kezdő) | 1 | 80 000 | (állati) |
| Egyéb eszköz (körmölő, fülszám) | 1 | 150 000 | 10 |
| **CAPEX összesen (becsült)** | | **~5 060 000** | |

### 7.3 OPEX (éves)

| Tétel | Egységár | Mennyiség / juh / év | Megjegyzés |
|---|---|---|---|
| Széna | 50 Ft/kg | 150 kg | téli időszak |
| Abrak (kiegészítő) | 180 Ft/kg | 30 kg | ellés körül + bárányoknak |
| Só, ásványi anyag | — | — | ~3 000 Ft/juh/év |
| Állatorvos (oltás, féregirtás) | — | — | ~8 000 Ft/juh/év |
| Körmölés (saját vagy bérelt) | — | 2× | 1 500 Ft/juh/alkalom |
| Biztosítás | — | — | ~5 000 Ft/juh/év |
| Saját munka | — | 1 óra/juh/hét | 3 000 Ft/óra (opcionális) |
| Energia, eszközfenntartás | átalány | — | 80 000 Ft/év |

### 7.4 Bevétel

| Forrás | Mennyiség | Egységár |
|---|---|---|
| Vágott bárány (élősúly 30 kg, kihozat 52%) | szaporulat × értékesítési arány | **2 800 Ft/kg élősúly** *vagy* **5 500 Ft/kg vágott** |
| Tenyészbárány eladás | 25% a szaporulatból | 60 000 Ft / db |
| Selejt anyajuh | 1/6 állomány / év | 35 000 Ft / db |
| Trágya | ~500 kg / juh / év | 15 Ft/kg |

### 7.5 Pénzügyi feltételezések

| Paraméter | Érték |
|---|---|
| Diszkontráta (NPV-hez) | 8% |
| Időhorizont | 5 év |
| Inflációs ráta (OPEX index) | 5% / év |
| Saját munka beszámítása | kapcsoló (ON/OFF), alap: OFF |

---

## 8. Adatmodell

### 8.1 Bemeneti YAML szcenárió struktúra

```yaml
# scenarios/baseline.yaml
meta:
  name: "Kameruni juh — alap szcenárió"
  project_code: "kameruni-juh"
  version: "0.1.0"
  created_at: "2026-05-20"
  currency: "HUF"

horizon:
  years: 5
  start_year: 2026

financial:
  discount_rate: 0.08
  inflation_rate: 0.05
  include_own_labor_cost: false

flock:
  initial_ewes: 20
  initial_rams: 1
  ewe_productive_years: 6
  lambings_per_ewe_per_year: 1.3
  lambs_per_lambing: 1.6
  lamb_survival_rate: 0.90
  adult_mortality_rate: 0.03

capex:
  - { name: "Kerítés",         qty: 800, unit_price: 1500,   lifetime_years: 15 }
  - { name: "Karám",           qty: 80,  unit_price: 35000,  lifetime_years: 25 }
  - { name: "Itató",           qty: 4,   unit_price: 25000,  lifetime_years: 10 }
  # ...

opex:
  feed:
    hay_kg_per_animal: 150
    hay_price_per_kg: 50
    concentrate_kg_per_animal: 30
    concentrate_price_per_kg: 180
  veterinary_per_animal: 8000
  insurance_per_animal: 5000
  utilities_flat: 80000
  own_labor_hours_per_animal_per_week: 1
  own_labor_hourly_rate: 3000

revenue:
  lamb_meat:
    enabled: true
    sell_ratio_of_lambs: 0.70
    live_weight_kg: 30
    dressing_percentage: 0.52
    price_per_kg_carcass: 5500
  breeding_stock_sale:
    enabled: true
    ratio_of_lambs: 0.25
    price_per_head: 60000
  cull_ewes:
    enabled: true
    price_per_head: 35000
  manure:
    enabled: true
    kg_per_animal_per_year: 500
    price_per_kg: 15
```

### 8.2 Kimeneti adatstruktúrák

- **`cashflow_df`** (pandas DataFrame, index = év): `year`, `capex`, `opex_total`, `revenue_total`, `net_cashflow`, `cumulative_cashflow`, `discounted_cashflow`
- **`opex_breakdown_df`**: tétel × év mátrix
- **`revenue_breakdown_df`**: forrás × év mátrix
- **`flock_evolution_df`**: év × kategória (anyajuhok, kosok, bárányok, eladott bárányok, selejt)
- **`kpis`** (dict): `npv`, `irr`, `payback_years`, `break_even_year`, `total_capex`, `avg_yearly_opex`, `avg_yearly_revenue`, `roi_total`

---

## 9. Technológiai stack és függőségek

| Komponens | Választás | Indok |
|---|---|---|
| Notebook | **Jupyter Lab / Notebook 7** | Standard, ipywidgets jól támogatott |
| Nyelv | **Python 3.11+** | |
| Számítás | **pandas, numpy, scipy** | DataFrame, IRR (`scipy.optimize.brentq`) |
| Vizualizáció | **plotly** | Interaktív, exportálható, jól néz ki notebookon belül |
| Widgetek | **ipywidgets** | Csúszkák, dropdown, élő frissítés |
| YAML | **PyYAML** | Szcenáriók |
| Excel | **openpyxl** | XLSX export |
| Lint / format | **ruff, black** | Konvenció |

### 9.1 `requirements.txt` (tervezett)

```text
jupyterlab>=4.0
ipywidgets>=8.1
pandas>=2.2
numpy>=1.26
scipy>=1.12
plotly>=5.20
pyyaml>=6.0
openpyxl>=3.1
```

---

## 10. Mappa- és fájlstruktúra

```text
apps/cost-planner/
├── README.md                          # Cost Planner sablon áttekintés
├── requirements.txt                   # Közös Python függőségek
├── shared/                            # Sablon kód, újrahasznosítható
│   ├── __init__.py
│   ├── financial.py                   # NPV, IRR, Payback, Break-even
│   ├── widgets.py                     # ipywidgets builderek
│   ├── visuals.py                     # plotly chart builderek
│   ├── exporters.py                   # Excel / CSV export
│   └── scenario.py                    # YAML betöltés / mentés
└── projects/
    └── kameruni-juh/
        ├── PRD.md                     # <-- EZ A FÁJL
        ├── kameruni_juh.ipynb         # Fő notebook
        ├── scenarios/
        │   ├── baseline.yaml
        │   ├── optimistic.yaml
        │   ├── realistic.yaml
        │   └── pessimistic.yaml
        ├── exports/                   # Excel/CSV/PDF kimenetek (gitignore)
        └── data/                      # Egyéb projekt-specifikus adat (opcionális)
```

### 10.1 Notebook szakaszok (cellákban)

1. **Bevezető markdown** — projekt rövid leírása
2. **Importok** (felül, egy cellában)
3. **YAML szcenárió betöltés** + alap felülírás widgetekkel
4. **Paraméter widgetek** csoportonként (collapsible accordion)
5. **CAPEX számítás cella**
6. **OPEX számítás cella**
7. **Állomány-evolúció cella**
8. **Bevétel számítás cella**
9. **Cashflow összeállítás**
10. **Pénzügyi KPI-k**
11. **Szcenárió összehasonlítás** (mindhárom yaml újra-futtatva)
12. **Érzékenység-elemzés**
13. **Dashboard** (8 vizualizáció)
14. **Export gombok**

---

## 11. Nem-funkcionális követelmények

| Kategória | Követelmény |
|---|---|
| **Teljesítmény** | A teljes notebook újrafuttatása <5 másodperc reális szcenárióval. |
| **Használhatóság** | Nem-programozó felhasználó 10 percen belül módosítani tud paramétert és látja az eredményt. |
| **Karbantarthatóság** | Üzleti logika a `shared/` modulban, projekt-specifikum a notebookban — DRY, SoC. |
| **Tesztelhetőség** | A `shared/financial.py` egységtesztekkel (pytest), legalább NPV/IRR/Payback. |
| **Reprodukálhatóság** | YAML + Python verzió rögzítve → ugyanaz a kimenet bárhol. |
| **Lokalizáció** | UI feliratok és gráf címek **magyarul**; numerikus formátum: `1 234 567 Ft`. |
| **Verziókezelés** | A notebook **kimenete ne kerüljön Gitbe** (nbstripout vagy ekvivalens). |

---

## 12. Mérföldkövek

| Fázis | Tartalom | Becsült ráfordítás |
|---|---|---|
| **M0 — PRD jóváhagyás** | Ez a dokumentum | 0.5 nap |
| **M1 — Sablon csontváz** | `shared/` modulok, üres notebook, baseline.yaml | 1 nap |
| **M2 — CAPEX + OPEX** | Bemeneti widgetek, számítások, alap táblák | 1 nap |
| **M3 — Bevétel + Cashflow** | Állomány-evolúció, pénzügyi mutatók | 1 nap |
| **M4 — Dashboard** | 8 plotly vizualizáció | 1 nap |
| **M5 — Szcenáriók + érzékenység** | 3 yaml, tornado-diagram | 0.5 nap |
| **M6 — Export + dokumentáció** | Excel/CSV/PDF, README | 0.5 nap |
| **M7 — Validáció** | Reális adatokkal végigfuttatás, tagi review | 0.5 nap |
| **Összesen** | | **~6 nap** |

---

## 13. Kockázatok és nyitott kérdések

| ID | Kockázat / kérdés | Hatás | Mitigáció |
|---|---|---|---|
| R1 | A magyar piaci árak (széna, bárányhús) régiónként szórnak | Pontatlan terv | YAML felülírás könnyű, érzékenység-elemzés mutatja a hatást |
| R2 | Mortalitási és szaporulati ráták valós szórása nagy | Optimista terv | Pesszimista szcenárió +20% mortalitással kötelező |
| R3 | A saját munka „valós" költsége vitatott közösségi kontextusban | Félreértés | Külön kapcsoló, alapból OFF, transzparens megjelenítés |
| R4 | Adózás (kiegészítő tevékenység vs. őstermelő) nincs modellezve | Bevétel nem nettó | V2 — egyszerűsített adózási kapcsoló |
| R5 | CURR integráció később jön — duplikált adat | Karbantartási teher | YAML → CURR tranzakció exporter külön ticket (lásd 15) |

---

## 14. Sikermutatók (KPI a PRD megvalósítására)

- A notebook **első futtatása** új gépen, friss klónon, `pip install -r requirements.txt` után **0 hibával** lefut.
- A pénzügyi mutatók eltérése **manuális Excel-számítástól** <1% (validáció).
- A három előre definiált szcenárió **különböző NPV-t és IRR-t** ad (sanity check).
- Minimum **3 közösségi tag** képes 30 percen belül módosítani és értelmezni az eredményt.

---

## 15. Jövőbeli bővítések (V2+)

- **CURR/KÖR integráció**: a notebook YAML-jából legenerálható egy CURR tranzakció-csontváz (debit/credit párokkal, projekt-számlán) — könnyíti a tervezett tételek könyvelésbe vezetését.
- **Honline tény-adat import**: a `konyveles.tranzakciok.csv` exportból a projektre szűrt tételek automatikus betöltése → **terv vs. tény** összevetés ugyanazon a dashboardon.
- **Portfolio dashboard**: több projekt aggregált megjelenítése (méhészet + kameruni juh + kertészet).
- **Sztochasztikus szimuláció**: Monte Carlo a kulcs paramétereken (10 000 futás → NPV eloszlás).
- **Web deploy**: a notebook `voila` vagy `streamlit` köntösben, közösségi tagoknak telepítés nélkül elérhető.
- **Forrás-katalógus**: a CURR `CurrencyType` koncepciója alapján a takarmány, munka, állat természetben is mérhető (több-pénznem).
- **Tagi részvétel modul**: ki vállalja melyik OPEX tételt (saját munka, takarmányadás), és ebből automatikusan generálódik a tagi időbefektetés terv.

---

## 16. Függelék — Hivatkozások

- **CURR/KÖR adatmodell**: `docs/readme.md`
- **Honline könyvelési export**: `docs/honline.export/`
- **Számlatükör**: `docs/honline.export/számlarend.szamlatukor.csv` — a CAPEX/OPEX tételek könyvelési számlákra mappelése a V2 integrációhoz.
- **Kameruni juh tenyésztési ajánlások**: Magyar Juhtenyésztők Szövetsége (külső, nem repó).
