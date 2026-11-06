# Org-scoping Document Service middleware (cloud agent prompt)

Ez a fájl egy készen beilleszthető, angol nyelvű cloud agent promptot tartalmaz Cursorhoz; az alábbi bevezető **nem** része az agent promptnak.

## Cloud agent prompt

```text
## Goal
Implement organization-scoped Document Service filtering for selected Curr APIs, using a many-to-many link between the users-permissions User and Organization.

## Repo
pitiboy/curr (Strapi 5 + content-backoffice).

## 1. User ↔ Organization relation
- Extend users-permissions User via `src/extensions/users-permissions/content-types/user/schema.json`.
- Add a **many-to-many** relation to `api::organization.organization` (name it clearly, e.g. `organizations`).
- Let Strapi create the join table; do not hand-roll SQL.
- **Do not** modify the Role table.
- **Do not** create a new membership content type; leave the existing `membership` / `membership-type` models and their `rules` unchanged.
- Registration is disabled in this project — **do not** add `register.allowedFields` (or any registration field config).

## 2. Admin UI
- Rely on out-of-the-box Content Manager multi-select on both sides (User → organizations, Organization → users if the inverse is set appropriately).
- **No** custom admin injection zones, no Settings form patches, no DOM hacks.

## 3. Document Service middleware (selective, not global)
Register Document Service middleware that runs **only** for the content types / document UIDs that back these product surfaces (investigate the real UIDs and schemas in the repo; map Hungarian product names to code):
- termelés (production)
- átvezetés (pool / inter-org transfer)
- osztás (distribution)
- eladás (sales)
- report pages’ transaction (and related) reads that currently load via Document Service / Content API

Do **not** register a global middleware for every content type. Prefer an explicit allowlist of UIDs (named constant).

Middleware behaviour (top of handler):
1. If the current user’s role needs **no** scoping (e.g. admin / a clearly named bypass role — discover what Curr already uses for unrestricted access; document the choice as a named constant), `return next()` immediately.
2. Otherwise load the user’s linked organizations.
3. Inject an organization constraint into `params.filters` (merge with `$and` so existing filters are preserved) **before** the DB query for find/findMany/findFirst/count (and equivalent Document Service actions you confirm are needed).
4. On create (if in scope), set/constrain organization from the user’s allowed set so they cannot write outside scope.

No external auth / Permit.io / third-party PDP. Keep everything in-repo.

## 4. Extension hygiene and Strapi 5 caveats
- Changes only under `src/extensions/`, app APIs, and tests — **never** patch `node_modules`.
- Mind Strapi v5 quirks: users-permissions relation lifecycle / `documentId` bugs — prefer `afterCreate` or route middleware over `beforeCreate` if you must set relations in hooks.
- Be careful with inverse relations on User (known forgot-password email breakage); prefer a relation shape that keeps forgot-password working, and note the choice in the PR.
- After major Strapi upgrades, re-verify schema merge and middleware.

## 5. Process and done criteria
- New branch from default; open a **draft PR**.
- PR description in Hungarian: User–Organization M2M, which UIDs are scoped, bypass roles, how filters are injected.
- Tests: admin (or bypass) sees unscoped; non-admin only sees their orgs; a content type **not** on the allowlist stays unfiltered.
- `tsc` / lint / relevant vitest (or project test command) green for touched packages.

## Out of scope
- Changing SPA RoleGuard / menu visibility (separate concern).
- Reworking membership egg `rules`.
- External authorization products.

## Done when
User schema extension exists; selective Document Service middleware is wired; tests cover bypass / isolation / unlisted UID; draft PR opened; checks green.
```
