# Neon Postgres – napi logikai mentés (GitHub Actions)

A [`Neon Postgres backup`](../../.github/workflows/neon-postgres-backup.yml) workflow **naponta egyszer** (02:30 UTC) és **kézi** `workflow_dispatch` futással készít **három független** PostgreSQL logikai dumpot (`pg_dump -Fc`), **age** titkosítással, **30 napos** artifact megőrzéssel.

> **Fontos:** A mentés **csak** a beállítások megadása és a PR **main**-be merge után indul el. Addig a workflow létezik, de a secretek nélkül a preflight **azonnal hibára fut**.

## Mit ment és mit nem?

- **Igen:** a secretben megadott **egyetlen adatbázis** séma + adat (logikai dump).
- **Nem:** globális Postgres szerepkörök, Neon projekt beállítások, Strapi `public/uploads` és egyéb külső fájlok.

## GitHub beállítások (te töltöd ki)

Nyilvános repo: [github.com/pitiboy/curr](https://github.com/pitiboy/curr)

| Hol                                                                               | Név                          | Típus                                  |
| --------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------- |
| [Secrets → Actions](https://github.com/pitiboy/curr/settings/secrets/actions)     | `NEON_BACKUP_DATABASE_URL_1` | Secret                                 |
| Ugyanitt                                                                          | `NEON_BACKUP_DATABASE_URL_2` | Secret                                 |
| Ugyanitt                                                                          | `NEON_BACKUP_DATABASE_URL_3` | Secret                                 |
| [Variables → Actions](https://github.com/pitiboy/curr/settings/variables/actions) | `BACKUP_AGE_RECIPIENT`       | Variable (`age1…` **nyilvános** kulcs) |

Mind a **három** DB secret **kötelező** – hiányzó esetén a workflow **láthatóan elbukik** (preflight + érintett matrix job).

### connection string követelmények

- Neon **direct (non-pooler)** host – **tilos** a `-pooler` / pooler hostname.
- URI formátum: `postgresql://…` – **jelszó csak secretben**, soha ne add meg URL-ben a workflow YAML-ban.
- Ajánlott query: `sslmode=require` (+ Neon által kért `channel_binding` / `options`, ha van a konzolon).

A secret **tartalmát** a repó nem ismeri; a slot (`1` / `2` / `3`) csak címke az artifactokban (`db-1`, `db-2`, `db-3`).

## age kulcs (Mac, offline)

```bash
brew install age
age-keygen -o ~/secure/neon-backup-age.txt
```

- **Privát kulcs** (`neon-backup-age.txt`): csak nálad, offline mentéssel.
- **Nyilvános recipient** (a fájlban `# public key: age1…`): ezt másold be `BACKUP_AGE_RECIPIENT` variable-be.

Titkosítás nélküli artifact **nincs** – csak `.dump.age` + manifest + checksum kerül fel.

## Ütemezés és artifactok

|               |                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow neve | **Neon Postgres backup**                                                                                                                        |
| Ütemezés      | `30 2 * * *` → **02:30 UTC** (≈ 03:30 Budapest télen / 04:30 nyáron); a GitHub queue csúsztathat                                                |
| Kézi futás    | Actions → **Neon Postgres backup** → **Run workflow**                                                                                           |
| Artifact név  | `neon-pg-backup-db-{1\|2\|3}-{run_id}`                                                                                                          |
| Megőrzés      | **pontosan 30 nap** / artifact                                                                                                                  |
| Matrix        | `fail-fast: false` – egy DB hibája **nem állítja le** a másik kettő mentését; a workflow **összesítve mégis failed**, ha bármelyik slot elbukik |

Az összesítő summary **per-slot titkosított méretet** és **összesített bájt** értéket ír (becsléshez: × 30 nap). Egy adatbázisról ~559 KB méret **egyszer** lett mérve; a másik kettő **nincs** mérve.

## Első éles teszt (te)

1. Merge a `main`-be (ez a PR **után**).
2. Ellenőrizd a fenti secreteket / variable-t.
3. Actions → **Neon Postgres backup** → **Run workflow**.
4. Töltsd le mindhárom artifactot (vagy csak egyet próbára).
5. **Visszaállítás csak új, üres teszt DB-be** (soha ne productionre):

```bash
age -d -i ~/secure/neon-backup-age.txt -o dump.dump artifact/neon-pg-backup-db-1-….dump.age
pg_restore --list dump.dump          # tartalom lista, nem restore
createdb my_restore_test             # üres cél DB
pg_restore -d my_restore_test --no-owner --no-acl dump.dump
```

## Költség / jogosultság

- Artifactok a repo **Actions** tárhelyén – Free csomagnál ~500 MB limit (**ne** kapcsold be a fizetős billinget csak emiatt).
- **Privát** repónál a scheduled workflow csak GitHub Team/Enterprise szabályok mellett megbízható – nyilvános repónál ez a korlát általában nem gond.
- A repó **olvasói** letölthetik a titkosított dumpot, de **visszafejtéshez** kell a privát age kulcsod.

## Scriptek (helyi, production nélkül)

```bash
bash scripts/backup/test-configure-libpq.sh
bash scripts/backup/test-local-matrix.sh   # 3 eldobható DB, párhuzamos OK + db-2 izolált hiba
```

## Biztonsági megjegyzések

- PostgreSQL **18** kliens a runneren (PGDG); kompatibilitás ellenőrzés, egyértelmű hiba incompatibility esetén.
- A teljes DB URL **soha** nem kerül parancssorba; libpq service fájl, 0600, exitkor törlés.
- Logok/summary **sanitizáltak**; credential nem kerül artifactba.
