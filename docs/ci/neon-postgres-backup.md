# Neon Postgres – napi logikai mentés (GitHub Actions)

A [`Neon Postgres backup`](../../.github/workflows/neon-postgres-backup.yml) workflow **naponta egyszer** (02:30 UTC) és **kézi** `workflow_dispatch` futással készít **két független** PostgreSQL logikai dumpot (`pg_dump -Fc`), **age** titkosítással, **30 napos** artifact megőrzéssel.

> **Fontos:** A mentés **csak** a beállítások megadása és a PR **main**-be merge után indul el. Addig a workflow létezik, de a secretek nélkül a preflight **azonnal hibára fut**.

## Mit ment és mit nem?

- **Igen:** a secretben megadott **egyetlen adatbázis** séma + adat (logikai dump).
- **Nem:** globális Postgres szerepkörök, Neon projekt beállítások, Strapi `public/uploads` és egyéb külső fájlok.

## GitHub beállítások (te töltöd ki)

Nyilvános repo: [github.com/pitiboy/curr](https://github.com/pitiboy/curr)

| Hol                                                                               | Név                                | Típus                                  |
| --------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------- |
| [Secrets → Actions](https://github.com/pitiboy/curr/settings/secrets/actions)     | `NEON_BACKUP_DATABASE_URL_ZEP`     | Secret                                 |
| Ugyanitt                                                                          | `NEON_BACKUP_DATABASE_URL_EDIZONE` | Secret                                 |
| [Variables → Actions](https://github.com/pitiboy/curr/settings/variables/actions) | `BACKUP_AGE_RECIPIENT`             | Variable (`age1…` **nyilvános** kulcs) |

Mind a **két** DB secret **kötelező** – hiányzó esetén a workflow **láthatóan elbukik** (preflight + érintett matrix job).

### connection string követelmények

- Neon **direct (non-pooler)** host – **tilos** a `-pooler` / pooler hostname.
- URI formátum: `postgresql://…` – **jelszó csak secretben**, soha ne add meg URL-ben a workflow YAML-ban.
- Ajánlott query: `sslmode=require` (+ Neon által kért `channel_binding` / `options`, ha van a konzolon).

A secret **tartalmát** a repó nem ismeri; a címke az artifactokban: `db-zep`, `db-edizone`.

## age kulcs (Mac, offline)

```bash
brew install age
age-keygen -o ~/secure/neon-backup-age.txt
```

- **Privát kulcs** (`neon-backup-age.txt`): csak nálad, offline mentéssel.
- **Nyilvános recipient** (a fájlban `# public key: age1…`): ezt másold be `BACKUP_AGE_RECIPIENT` variable-be.

Titkosítás nélküli artifact **nincs** – csak `.dump.age` + manifest + checksum kerül fel.

## Ütemezés és artifactok

|               |                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Workflow neve | **Neon Postgres backup**                                                                                                      |
| Ütemezés      | `30 2 * * *` → **02:30 UTC** (≈ 03:30 Budapest télen / 04:30 nyáron); a GitHub queue csúsztathat                              |
| Kézi futás    | Actions → **Neon Postgres backup** → **Run workflow**                                                                         |
| Artifact név  | `neon-pg-backup-db-{zep\|edizone}-{run_id}`                                                                                   |
| Megőrzés      | **pontosan 30 nap** / artifact                                                                                                |
| Matrix        | `fail-fast: false` – egy DB hibája **nem állítja le** a másikat; a workflow **összesítve mégis failed**, ha bármelyik elbukik |

Az összesítő summary **per-db titkosított méretet** és **összesített bájt** értéket ír (becsléshez: × 30 nap). Egy adatbázisról ~559 KB méret **egyszer** lett mérve; a másik **nincs** mérve.

## Hol vannak az artifactok?

**Böngésző:** repo → **Actions** → **Neon Postgres backup** → egy run → lap alja → **Artifacts** (`neon-pg-backup-db-zep-…`, `neon-pg-backup-db-edizone-…`).

## Artifactok listázása `gh`-val

Előfeltétel: [`gh`](https://cli.github.com/) bejelentkezve (`gh auth status`), jog a `pitiboy/curr` repóra.

**Nem lejárt** artifactok neve + méret + összesen (MB, decimális):

```bash
gh api 'repos/pitiboy/curr/actions/artifacts?per_page=100' --paginate \
  | jq -s '[.[].artifacts[] | select(.expired == false)] as $a
    | ($a[] | "\(.name)\t\(.size_in_bytes / 1000000) MB"),
       "Összesen: \(($a | map(.size_in_bytes) | add // 0) / 1000000) MB"' -r
```

Csak backup artifactok:

```bash
gh api 'repos/pitiboy/curr/actions/artifacts?per_page=100' --paginate \
  | jq -s '[.[].artifacts[] | select(.expired == false and (.name | startswith("neon-pg-backup-db-")))] as $a
    | ($a[] | "\(.name)\t\(.size_in_bytes / 1000000) MB"),
       "Összesen: \(($a | map(.size_in_bytes) | add // 0) / 1000000) MB"' -r
```

**Letöltés adott run-ból** (legegyszerűbb, ha ismered a run id-t):

```bash
gh run list --repo pitiboy/curr --workflow=neon-postgres-backup.yml --limit 5
gh run download RUN_ID --repo pitiboy/curr -D ./backup-artifacts
```

**Letöltés artifact id alapján** (az API listából `id` mező):

```bash
ARTIFACT_ID=123456789
gh api "repos/pitiboy/curr/actions/artifacts/${ARTIFACT_ID}/zip" > artifact.zip
unzip -d ./artifact artifact.zip
```

## age → custom dump (`.dump`)

A zipben a `neon-pg-backup-db-{zep|edizone}-….dump.age` fájl titkosított. **Privát kulcs** kell (nem a GitHub `BACKUP_AGE_RECIPIENT`).

```bash
brew install age   # ha kell

age -d -i ~/secure/neon-backup-age.txt \
  -o zep.dump \
  ./backup-artifacts/neon-pg-backup-db-zep-….dump.age
```

- `-o` kimenet: **PostgreSQL custom format** (`pg_dump -Fc`), **nem** plain `.sql`.
- Teszt tartalomjegyzék (nem ír DB-be): `pg_restore --list zep.dump | less`

Macen kliens: `brew install libpq` majd pl. `export PATH="/opt/homebrew/opt/libpq/bin:$PATH"` — egyezzen a szerver major verziójával (a CI **18**-at használ).

## `pg_restore`: SQL fájl a dumpból

Custom formatból **SQL szkript** fájlba (olvasható, szerkeszthető, de lehet nagy):

```bash
pg_restore -f zep-restore.sql zep.dump
```

Csak séma (nincs adat):

```bash
pg_restore --schema-only -f zep-schema.sql zep.dump
```

Csak adat (feltételezett, hogy a séma már létezik):

```bash
pg_restore --data-only -f zep-data.sql zep.dump
```

> A `-f` kimenet **restore parancsok sorozata** (nem feltétlenül egyetlen `COPY` blokk). Nagy DB-nél a közvetlen restore gyakran praktikusabb, mint egy óriási `.sql`.

## `pg_restore`: visszaállítás üres cél adatbázisba

**Ne** production / élő app DB-re. Ideális: új Neon branch, új üres adatbázis, vagy lokális `createdb`.

```bash
# példa lokálisan
createdb zep_restore_test

pg_restore -d zep_restore_test --no-owner --no-acl --verbose zep.dump
```

Neon / távoli cél (direct host, **üres** `dbname` — a connection stringet **ne** echo-zd logba):

```bash
export PGHOST=… PGPORT=5432 PGUSER=… PGPASSWORD=… PGDATABASE=zep_restore_test PGSSLMODE=require

pg_restore -d "$PGDATABASE" --no-owner --no-acl --verbose zep.dump
```

Ha a cél DB-ben már vannak objektumok és **felül akarod írni** (veszélyes — csak eldobható teszten):

```bash
pg_restore -d zep_restore_test --clean --if-exists --no-owner --no-acl zep.dump
```

`--clean` DROP-ot is generál; productionön **ne** használd.

## Első éles ellenőrzés (checklist)

1. Secrets / variable beállítva (`ZEP`, `EDIZONE`, `BACKUP_AGE_RECIPIENT`).
2. Actions → **Neon Postgres backup** → **Run workflow** → mindkét matrix job zöld.
3. Artifact letöltés (böngésző vagy `gh run download`).
4. `age -d` → `pg_restore --list` (vagy restore **csak teszt DB**-re).

## Költség / jogosultság

- Artifactok a repo **Actions** tárhelyén – Free csomagnál ~500 MB limit (**ne** kapcsold be a fizetős billinget csak emiatt).
- **Privát** repónál a scheduled workflow csak GitHub Team/Enterprise szabályok mellett megbízható – nyilvános repónál ez a korlát általában nem gond.
- A repó **olvasói** letölthetik a titkosított dumpot, de **visszafejtéshez** kell a privát age kulcsod.

## Scriptek (helyi, production nélkül)

```bash
bash scripts/backup/test-configure-libpq.sh
bash scripts/backup/test-local-matrix.sh   # zep + edizone, párhuzamos OK + edizone izolált hiba
```

## Biztonsági megjegyzések

- PostgreSQL **18** kliens a runneren (PGDG); kompatibilitás ellenőrzés, egyértelmű hiba incompatibility esetén.
- A teljes DB URL **soha** nem kerül parancssorba; libpq service fájl, 0600, exitkor törlés.
- Logok/summary **sanitizáltak**; credential nem kerül artifactba.
