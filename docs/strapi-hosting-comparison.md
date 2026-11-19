# Strapi / Node.js hosting összehasonlítás

Kutatás dátuma: 2026-11-19. Cél: a DotRoll cPanel (Phusion Passenger) hidegindításának (30+ mp) megszüntetése.

## Feltételek

- 1 Strapi 5 példány költözik, a többi maradhat a jelenlegi helyén.
- Az adatbázis marad a Neonban (EU).
- Keret: legfeljebb bruttó 5 000 Ft/hó.
- VPS is jó (Coolify / Docker), ha egyszerű.
- Pár másodperces ébredés elfogadható.
- A média mehet külső tárhelyre (pl. S3 / Cloudflare R2).
- Használat: napi 1–3 munkamenet, egyenként 5–15 perc.

Árfolyam (MNB, 2026-11-19): 1 € = 368,97 Ft, 1 $ = 335,64 Ft. Az árak magánszemélyként, 27% ÁFÁ-val számolva.

## Összehasonlítás

| Szolgáltató, csomag | CPU / RAM | Régió | Alvás | Havi díj (bruttó) | Üzemeltetés | Megjegyzés |
|---|---|---|---|---|---|---|
| [OVHcloud VPS-1](https://www.ovhcloud.com/en-ie/vps/) | 2 / 4 GB | EU, van német | nincs | kb. 1 785 Ft | VPS + Coolify | a legolcsóbb, napi backuppal |
| [Contabo Cloud VPS 4](https://contabo.com/en/vps/) | 4 / 8 GB | Németország | nincs | kb. 2 062 Ft | VPS + Coolify | 24 hónapos promóár, a támogatás gyengébb |
| [Hetzner CAX11](https://www.hetzner.com/cloud/cost-optimized/) | 2 ARM / 4 GB | Nürnberg, Falkenstein | nincs | kb. 3 280 Ft | VPS + Coolify | megbízható, a Neonhoz közel van; az x86-os CX23 kb. 3 040 Ft, ha éppen van készleten |
| [DotRoll Prémium Small](https://dotroll.com/hu/szolgaltatasok/premium-vps/) | 2 / 2 GB | Németország | nincs | 3 227 Ft | VPS | 2 GB szűk Coolifyhoz és a buildhez |
| [netcup VPS 500](https://www.netcup.com/en/server/vps) | 2 / 4 GB | Nürnberg, Bécs | nincs | kb. 3 871 Ft (12 hó) | VPS + Coolify | szerződéses |
| [Koyeb eco-medium](https://www.koyeb.com/pricing) | 1 / 2 GB | Frankfurt | nincs | kb. 4 565 Ft | git push PaaS | VPS nélkül, kártya kell |
| [Fly.io](https://fly.io/pricing), auto-stoppal | 1–2 / 2 GB | Frankfurt | igen, 5–15 mp ébredés (becslés) | kb. 500–1 500 Ft (becslés) | Docker, `fly launch` | ha mindig fut, ÁFÁ-val kilóg a keretből |
| [Railway Hobby](https://docs.railway.com/pricing), serverless | igény szerint | Amszterdam | csak elvileg alszik | kb. 2 130 Ft, ha alszik | git push | a nyitott Neon-kapcsolat ébren tarthatja, és akkor kb. 7 400 Ft |
| [Google Cloud Run](https://cloud.google.com/run/pricing) | 1–2 / 2 GB | Frankfurt | igen, 10–30+ mp (becslés) | használattól függ | GCP, bonyolultabb | az ébredés nem jobb a mostaninál |
| [Oracle Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) | 2 ARM / 12 GB | Frankfurt is lehet | nincs | 0 Ft | VPS, nehezebb | gyakran nincs szabad kapacitás, élesre nem ajánlott |

### Kereten kívül

- [Render](https://render.com/pricing): kb. 8 400 Ft
- [DigitalOcean App Platform](https://www.digitalocean.com/pricing/app-platform): 25 $
- [Northflank](https://northflank.com/pricing): kb. 8 050 Ft
- [Strapi Cloud](https://strapi.io/pricing-cloud): kb. 11 700 Ft
- [Heroku](https://www.heroku.com/pricing/) és [Scaleway](https://www.scaleway.com/en/pricing/virtual-instances/): kb. 5 100 Ft felett

## Javaslat

- **Elsődleges:** Hetzner CAX11 Coolifyval. A Strapi build GitHub Actionsben fut, a szerverre csak a kész image kerül.
- **Ha a legkisebb díj számít:** OVHcloud VPS-1, kb. feleannyiba kerül.
- **Ha nincs szerverüzemeltetés:** Koyeb (Frankfurt), git push alapú, nem alszik el.
