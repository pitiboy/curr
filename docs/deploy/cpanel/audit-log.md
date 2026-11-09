# HTTP audit log (cPanel / Passenger)

A Strapi globális `global::audit-log` middleware a `/api/`, `/admin/` és `/content-manager/` írásokról (és a login endpointokról) audit sort ír az `audit_logs` táblába, és párhuzamosan JSON-t a stdoutra (`AUDIT_LOG_SINK`, alapérték: `both`).

## Env (12-faktor)

Az összes kapcsoló a repó `.env.example` `AUDIT_LOG_*` blokkjában van dokumentálva. Élesen a cPanel alkalmazás env-jében állítsd (ugyanaz a fájl / panel, mint a többi Strapi titoknál).

Gyakori éles beállítások:

- `AUDIT_LOG_ENABLED=true`
- `AUDIT_LOG_SINK=both` — DB + Passenger stdout (későbbi log-forwarderhez)
- `AUDIT_LOG_RETENTION_DAYS=365` — éjfél utáni napi purge (Strapi cron, UTC 03:00)

## Hol olvasható a stdout

Passenger alatt a Strapi pino kimenete az alkalmazás logjába kerül (cPanel **Errors** / **Passenger log** / deploy script által említett fájl — aliasonként eltérő). Az audit események `audit` message mezővel és `audit` objektummal jelennek meg.

## Megjegyzés a cronról

A retenciós task csak akkor fut, amíg a Strapi process él. A purge idempotens; egy kimaradt éjszaka a következő futáskor pótolódik.
