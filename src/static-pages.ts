import { errors } from '@strapi/utils';
import MarkdownIt from 'markdown-it';

export const STATIC_PAGE_UID = 'api::static-page.static-page';

/** Public HTML path prefix on the Strapi host (no /api, no login). */
export const STATIC_PATH_PREFIX = '/static';

/** Slugs the Google OAuth consent screen and the footers link to. */
export const STATIC_PAGE_SLUGS = {
  privacyPolicy: 'privacy-policy',
  termsOfService: 'terms-of-service',
  about: 'about',
} as const;

/** Content API actions opened to the users-permissions `public` role. */
export const STATIC_PAGE_PUBLIC_ACTIONS = [
  'api::static-page.static-page.find',
  'api::static-page.static-page.findOne',
] as const;

/** Page languages. The first one is the default and the fallback. */
export const STATIC_PAGE_LOCALES = ['hu', 'en'] as const;
export type StaticPageLocale = (typeof STATIC_PAGE_LOCALES)[number];
export const DEFAULT_STATIC_PAGE_LOCALE: StaticPageLocale = 'hu';

/** i18n plugin locale rows the bootstrap makes sure exist. */
export const I18N_LOCALE_DEFS: Record<StaticPageLocale, { code: StaticPageLocale; name: string }> = {
  hu: { code: 'hu', name: 'Hungarian (hu)' },
  en: { code: 'en', name: 'English (en)' },
};

type UiStrings = {
  siteName: string;
  updated: string;
  backoffice: string;
  indexTitle: string;
  indexEmpty: string;
  notFoundTitle: string;
  notFoundBody: string;
  fallbackNotice: string;
  fallbackTitle: string;
  switchLabel: string;
};

const UI: Record<StaticPageLocale, UiStrings> = {
  hu: {
    siteName: 'KÖR – Közösségi Önjegyző Rendszer',
    updated: 'Utolsó módosítás',
    backoffice: 'Kezelő felület',
    indexTitle: 'Statikus oldalak',
    indexEmpty: 'Még nincs feltöltött dokumentum.',
    notFoundTitle: 'Nem található',
    notFoundBody: 'Ez a dokumentum még nincs feltöltve, vagy megváltozott a címe.',
    fallbackNotice: 'Ez az oldal még nem érhető el magyarul, ezért az alapnyelvi változatot látod.',
    fallbackTitle: 'Statikus oldal',
    switchLabel: 'Nyelv',
  },
  en: {
    siteName: 'KÖR – Community Unified Resource Registry',
    updated: 'Last updated',
    backoffice: 'Backoffice',
    indexTitle: 'Static pages',
    indexEmpty: 'No documents have been published yet.',
    notFoundTitle: 'Not found',
    notFoundBody: 'This document has not been published yet, or its address has changed.',
    fallbackNotice:
      'This page is not available in English yet, so you are seeing the Hungarian version.',
    fallbackTitle: 'Static page',
    switchLabel: 'Language',
  },
};

/**
 * Same family of parser the Strapi rich text (Markdown) editor previews with.
 * Raw HTML is escaped: the page is public, the body is admin-edited text.
 */
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
});

export type StaticPageRecord = {
  title?: string | null;
  slug?: string | null;
  body?: string | null;
  footer_order?: number | null;
  locale?: string | null;
  updatedAt?: string | Date | null;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidStaticPageSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && slug.length <= 128 && SLUG_PATTERN.test(slug);
}

/** `?locale=en` → `en`; anything unknown or missing → the default (`hu`). */
export function resolveStaticPageLocale(value: unknown): StaticPageLocale {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') {
    return DEFAULT_STATIC_PAGE_LOCALE;
  }
  const code = raw.trim().toLowerCase().slice(0, 2);
  return (STATIC_PAGE_LOCALES as readonly string[]).includes(code)
    ? (code as StaticPageLocale)
    : DEFAULT_STATIC_PAGE_LOCALE;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderStaticPageMarkdown(body: string) {
  return markdown.render(body ?? '');
}

/** `2026. 10. 16.` (hu) or `2026-10-16` (en) without relying on ICU data. */
export function formatStaticPageDate(
  value: string | Date | null | undefined,
  locale: StaticPageLocale = DEFAULT_STATIC_PAGE_LOCALE,
) {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  return locale === 'hu' ? `${y}. ${m}. ${d}.` : `${y}-${m}-${d}`;
}

/** `/static/privacy-policy` for hu (stable Google URL), `…?locale=en` for en. */
export function staticPagePath(slug?: string, locale: StaticPageLocale = DEFAULT_STATIC_PAGE_LOCALE) {
  const path = slug ? `${STATIC_PATH_PREFIX}/${slug}` : STATIC_PATH_PREFIX;
  return locale === DEFAULT_STATIC_PAGE_LOCALE ? path : `${path}?locale=${locale}`;
}

const STYLE = `
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6; color: #1f2933; background: #f7f9fb; }
  header, main, footer { box-sizing: border-box; max-width: 52rem; margin: 0 auto; padding: 1rem 1.25rem; }
  header { border-bottom: 1px solid #d9e2ec; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  header a.site { color: #1d4e86; font-weight: 600; text-decoration: none; }
  .lang a, .lang strong { margin-left: 0.5rem; font-size: 0.9rem; }
  .lang strong { color: #1f2933; }
  main { background: #fff; }
  h1 { color: #1d4e86; font-size: 1.75rem; margin-top: 0.5rem; }
  h2 { color: #1d4e86; font-size: 1.3rem; margin-top: 2rem; }
  h3 { font-size: 1.1rem; margin-top: 1.5rem; }
  a { color: #2a6fbf; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #d9e2ec; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
  th { background: #eef4fa; }
  blockquote { margin: 1rem 0; padding: 0.5rem 1rem; border-left: 4px solid #8a62b0; background: #f5f0fa; }
  .meta { color: #52606d; font-size: 0.9rem; }
  .notice { padding: 0.5rem 1rem; background: #fff7e0; border-left: 4px solid #e0a800; }
  footer { font-size: 0.9rem; color: #52606d; }
  footer nav a { margin-right: 1rem; }
  @media (prefers-color-scheme: dark) {
    body { color: #e4e7eb; background: #10161d; }
    main { background: #17202a; }
    header { border-color: #323f4b; }
    h1, h2, header a.site { color: #bfd4ec; }
    .lang strong { color: #e4e7eb; }
    a { color: #5f93cf; }
    th { background: #10243a; }
    th, td { border-color: #323f4b; }
    blockquote { background: #241a30; }
    .notice { background: #3a2f10; }
    .meta, footer { color: #9aa5b1; }
  }
`;

type RenderContext = {
  /** Language of the UI chrome and of the links. */
  locale: StaticPageLocale;
  /** Pages for the footer nav, already in the best available locale. */
  nav: StaticPageRecord[];
  /** Slug for the HU/EN switch; omitted on the index. */
  slug?: string;
};

function renderLanguageSwitch({ locale, slug }: RenderContext) {
  const items = STATIC_PAGE_LOCALES.map((code) =>
    code === locale
      ? `<strong lang="${code}">${code.toUpperCase()}</strong>`
      : `<a href="${escapeHtml(staticPagePath(slug, code))}" hreflang="${code}" lang="${code}">${code.toUpperCase()}</a>`,
  );
  return `<nav class="lang" aria-label="${UI[locale].switchLabel}">${items.join('')}</nav>`;
}

function renderFooterNav({ locale, nav }: RenderContext) {
  const links = nav
    .filter((page) => isValidStaticPageSlug(page.slug) && page.title)
    .map(
      (page) =>
        `<a href="${escapeHtml(staticPagePath(page.slug as string, locale))}">${escapeHtml(page.title as string)}</a>`,
    );
  links.push(`<a href="/backoffice/">${UI[locale].backoffice}</a>`);
  return `<nav>${links.join('')}</nav>`;
}

function renderDocument(title: string, content: string, ctx: RenderContext, contentLang?: string) {
  const ui = UI[ctx.locale];
  const alternates = ctx.slug
    ? STATIC_PAGE_LOCALES.map(
        (code) =>
          `<link rel="alternate" hreflang="${code}" href="${escapeHtml(staticPagePath(ctx.slug, code))}">`,
      ).join('\n')
    : '';
  const mainLang = contentLang && contentLang !== ctx.locale ? ` lang="${escapeHtml(contentLang)}"` : '';
  return `<!doctype html>
<html lang="${ctx.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} | KÖR</title>
${alternates}
<style>${STYLE}</style>
</head>
<body>
<header><a class="site" href="${escapeHtml(staticPagePath(undefined, ctx.locale))}">${escapeHtml(ui.siteName)}</a>${renderLanguageSwitch(ctx)}</header>
<main${mainLang}>
${content}
</main>
<footer>${renderFooterNav(ctx)}</footer>
</body>
</html>
`;
}

export function renderStaticPageHtml(
  page: StaticPageRecord,
  nav: StaticPageRecord[] = [],
  locale: StaticPageLocale = DEFAULT_STATIC_PAGE_LOCALE,
) {
  const ui = UI[locale];
  const title = page.title?.trim() || ui.fallbackTitle;
  const pageLocale = resolveStaticPageLocale(page.locale ?? locale);
  const isFallback = pageLocale !== locale;
  const updated = formatStaticPageDate(page.updatedAt, locale);
  const notice = isFallback ? `<p class="notice" lang="${locale}">${ui.fallbackNotice}</p>\n` : '';
  const meta = updated ? `<p class="meta" lang="${locale}">${ui.updated}: ${escapeHtml(updated)}</p>` : '';
  const slug = isValidStaticPageSlug(page.slug) ? page.slug : undefined;
  return renderDocument(
    title,
    `${notice}<h1>${escapeHtml(title)}</h1>\n${meta}\n${renderStaticPageMarkdown(page.body ?? '')}`,
    { locale, nav, slug },
    pageLocale,
  );
}

export function renderStaticPageIndexHtml(
  pages: StaticPageRecord[],
  locale: StaticPageLocale = DEFAULT_STATIC_PAGE_LOCALE,
) {
  const ui = UI[locale];
  const items = pages
    .filter((page) => isValidStaticPageSlug(page.slug) && page.title)
    .map(
      (page) =>
        `<li><a href="${escapeHtml(staticPagePath(page.slug as string, locale))}">${escapeHtml(page.title as string)}</a></li>`,
    );
  const list = items.length ? `<ul>${items.join('')}</ul>` : `<p>${ui.indexEmpty}</p>`;
  return renderDocument(ui.indexTitle, `<h1>${ui.indexTitle}</h1>\n${list}`, {
    locale,
    nav: pages,
  });
}

export function renderStaticPageNotFoundHtml(
  nav: StaticPageRecord[] = [],
  locale: StaticPageLocale = DEFAULT_STATIC_PAGE_LOCALE,
) {
  const ui = UI[locale];
  return renderDocument(ui.notFoundTitle, `<h1>${ui.notFoundTitle}</h1>\n<p>${ui.notFoundBody}</p>`, {
    locale,
    nav,
  });
}

type StaticPageDocuments = {
  findMany: (params?: Record<string, unknown>) => Promise<StaticPageRecord[]>;
  findFirst: (params?: Record<string, unknown>) => Promise<StaticPageRecord | null>;
};

export type StaticPagesStrapi = {
  documents: (uid: string) => StaticPageDocuments;
  server: { routes: (routes: unknown) => unknown };
  log?: { warn: (message: string) => void };
};

type HtmlContext = {
  params: Record<string, string | undefined>;
  query?: Record<string, unknown>;
  status: number;
  type: string;
  body: unknown;
  set: (field: string, value: string) => void;
};

/** Requested locale first, then the default; one entry per slug. */
function localeChain(locale: StaticPageLocale): StaticPageLocale[] {
  return locale === DEFAULT_STATIC_PAGE_LOCALE ? [locale] : [locale, DEFAULT_STATIC_PAGE_LOCALE];
}

async function listForNav(strapi: StaticPagesStrapi, locale: StaticPageLocale) {
  const bySlug = new Map<string, StaticPageRecord>();
  for (const code of localeChain(locale)) {
    try {
      const rows = await strapi.documents(STATIC_PAGE_UID).findMany({
        fields: ['title', 'slug', 'footer_order', 'locale'],
        sort: ['footer_order:asc', 'title:asc'],
        limit: 50,
        locale: code,
      });
      for (const row of rows ?? []) {
        if (row.slug && !bySlug.has(row.slug)) {
          bySlug.set(row.slug, row);
        }
      }
    } catch (error) {
      strapi.log?.warn(`Static pages: list (${code}) failed: ${String(error)}`);
    }
  }
  return [...bySlug.values()].sort(
    (a, b) =>
      (a.footer_order ?? 0) - (b.footer_order ?? 0) ||
      String(a.title ?? '').localeCompare(String(b.title ?? '')),
  );
}

/** The page in the requested locale, or the default-locale (hu) version. */
export async function findStaticPage(
  strapi: StaticPagesStrapi,
  slug: string,
  locale: StaticPageLocale,
) {
  for (const code of localeChain(locale)) {
    const page = await strapi
      .documents(STATIC_PAGE_UID)
      .findFirst({ filters: { slug: { $eq: slug } }, locale: code });
    if (page) {
      return { ...page, locale: page.locale ?? code };
    }
  }
  return null;
}

function sendHtml(ctx: HtmlContext, status: number, html: string) {
  ctx.status = status;
  ctx.type = 'text/html; charset=utf-8';
  ctx.set('Cache-Control', status === 200 ? 'public, max-age=300' : 'no-store');
  ctx.set('Vary', 'Accept-Encoding');
  ctx.body = html;
}

export function createStaticPageHandlers(strapi: StaticPagesStrapi) {
  return {
    async index(ctx: HtmlContext) {
      const locale = resolveStaticPageLocale(ctx.query?.locale);
      const pages = await listForNav(strapi, locale);
      sendHtml(ctx, 200, renderStaticPageIndexHtml(pages, locale));
    },
    async show(ctx: HtmlContext) {
      const locale = resolveStaticPageLocale(ctx.query?.locale);
      const slug = ctx.params.slug;
      const nav = await listForNav(strapi, locale);
      if (!isValidStaticPageSlug(slug)) {
        sendHtml(ctx, 404, renderStaticPageNotFoundHtml(nav, locale));
        return;
      }
      const page = await findStaticPage(strapi, slug, locale);
      if (!page) {
        sendHtml(ctx, 404, renderStaticPageNotFoundHtml(nav, locale));
        return;
      }
      sendHtml(ctx, 200, renderStaticPageHtml(page, nav, locale));
    },
  };
}

/**
 * Public, server-rendered pages on the Strapi host, outside the /api prefix:
 * `/static` (list) and `/static/:slug`, both with an optional `?locale=en`.
 * Always reflect the current DB content, so no rebuild is needed after
 * editing a page in Strapi Admin.
 */
const LEGACY_STATIC_PATH_PREFIX = '/legal';

type RedirectContext = {
  method: string;
  path: string;
  querystring?: string;
  redirect: (url: string) => void;
};

/** Permanent redirects from the old `/legal` URLs (Google OAuth, bookmarks). */
export function registerLegacyStaticPageRedirects(strapi: StaticPagesStrapi) {
  strapi.server.routes([
    {
      method: 'GET',
      path: LEGACY_STATIC_PATH_PREFIX,
      handler: (ctx: RedirectContext) => {
        const qs = ctx.querystring ? `?${ctx.querystring}` : '';
        ctx.redirect(`${STATIC_PATH_PREFIX}${qs}`);
      },
      config: { auth: false },
    },
    {
      method: 'GET',
      path: `${LEGACY_STATIC_PATH_PREFIX}/:slug`,
      handler: (ctx: RedirectContext & { params: { slug?: string } }) => {
        const slug = ctx.params.slug ?? '';
        const qs = ctx.querystring ? `?${ctx.querystring}` : '';
        ctx.redirect(`${STATIC_PATH_PREFIX}/${slug}${qs}`);
      },
      config: { auth: false },
    },
  ]);
}

export function registerStaticPageRoutes(strapi: StaticPagesStrapi) {
  const handlers = createStaticPageHandlers(strapi);
  registerLegacyStaticPageRedirects(strapi);
  strapi.server.routes([
    {
      method: 'GET',
      path: STATIC_PATH_PREFIX,
      handler: handlers.index,
      config: { auth: false },
    },
    {
      method: 'GET',
      path: `${STATIC_PATH_PREFIX}/:slug`,
      handler: handlers.show,
      config: { auth: false },
    },
  ]);
}

/**
 * `PUBLIC_HOME_REDIRECT` sets the site root target when explicitly configured
 * (e.g. cPanel env). Unset: no redirect (Strapi `/` → `/admin`). Example:
 * `/backoffice/` or `/static/about`. Empty or invalid: same as unset. Only
 * same-site paths are accepted.
 */
export function resolveHomeRedirect(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path === '/') {
    return null;
  }
  return path;
}

type RootContext = {
  method: string;
  path: string;
  querystring?: string;
  redirect: (url: string) => void;
};

export function createHomeRedirectMiddleware(target: string) {
  return async (ctx: RootContext, next: () => Promise<unknown>) => {
    if ((ctx.method === 'GET' || ctx.method === 'HEAD') && ctx.path === '/') {
      const query = ctx.querystring ? `${target.includes('?') ? '&' : '?'}${ctx.querystring}` : '';
      ctx.redirect(`${target}${query}`);
      return;
    }
    await next();
  };
}

export function resolveSiteHomeRedirectTarget(
  value: unknown = process.env.PUBLIC_HOME_REDIRECT,
) {
  if (value === undefined) {
    return null;
  }
  return resolveHomeRedirect(value);
}

export function registerHomeRedirect(
  strapi: { server: { use: (fn: unknown) => unknown }; log?: { info: (m: string) => void } },
  value: unknown = process.env.PUBLIC_HOME_REDIRECT,
) {
  const target = resolveSiteHomeRedirectTarget(value);
  if (!target) {
    return false;
  }
  strapi.server.use(createHomeRedirectMiddleware(target));
  strapi.log?.info(`Site root redirects to ${target}`);
  return true;
}

type LocalesService = {
  findByCode: (code: string) => Promise<{ id: number; code: string } | null>;
  create: (locale: { code: string; name: string }) => Promise<unknown>;
  setDefaultLocale: (params: { code: string }) => Promise<unknown>;
};

export type StaticPageLocalesStrapi = {
  plugin: (name: string) => { service: (name: string) => unknown } | undefined;
  log: { info: (message: string) => void; warn: (message: string) => void };
};

/**
 * Makes sure the hu and en i18n locales exist. hu becomes the default only
 * when this bootstrap is the one creating it, so a default chosen later in
 * Settings → Internationalization is never overridden on restart.
 */
export async function ensureStaticPageLocales(strapi: StaticPageLocalesStrapi) {
  const plugin = strapi.plugin('i18n');
  const locales = plugin?.service('locales') as LocalesService | undefined;
  if (!locales) {
    strapi.log.warn('Static pages bootstrap: i18n plugin not available, locales skipped');
    return;
  }

  for (const code of STATIC_PAGE_LOCALES) {
    const existing = await locales.findByCode(code);
    if (existing) {
      continue;
    }
    await locales.create(I18N_LOCALE_DEFS[code]);
    strapi.log.info(`Created i18n locale "${code}"`);
    if (code === DEFAULT_STATIC_PAGE_LOCALE) {
      await locales.setDefaultLocale({ code });
      strapi.log.info(`Set default i18n locale to "${code}"`);
    }
  }
}

type SlugGuardContext = {
  uid: string;
  action: string;
  params?: { documentId?: string; locale?: string; data?: { slug?: unknown } };
};

type SlugGuardStrapi = {
  documents: ((uid: string) => StaticPageDocuments) & {
    use: (
      middleware: (context: SlugGuardContext, next: () => Promise<unknown>) => Promise<unknown>,
    ) => unknown;
  };
};

/**
 * The slug is shared by every locale of one page, so it can't be a Strapi `uid`
 * (Strapi 5 checks uid uniqueness across locales and blocks the second locale).
 * Instead: a plain string, and this guard rejects the same slug twice in one locale.
 */
export function registerStaticPageSlugGuard(strapi: SlugGuardStrapi) {
  strapi.documents.use(async (context, next) => {
    if (
      context.uid === STATIC_PAGE_UID &&
      (context.action === 'create' || context.action === 'update')
    ) {
      const slug = context.params?.data?.slug;
      if (typeof slug === 'string' && slug.length > 0) {
        if (!isValidStaticPageSlug(slug)) {
          throw new errors.ValidationError(
            'Slug: only lowercase letters, digits and single hyphens (e.g. privacy-policy)',
          );
        }
        const existing = (await (strapi.documents(STATIC_PAGE_UID) as unknown as {
          findMany: (params: unknown) => Promise<Array<{ documentId?: string }>>;
        }).findMany({
          filters: { slug: { $eq: slug } },
          fields: ['slug'],
          // Same slug in another locale is the same page (or its translation);
          // only a second page with this slug in the same locale is a conflict.
          locale: context.params?.locale ?? DEFAULT_STATIC_PAGE_LOCALE,
        })) ?? [];
        const ownId = context.params?.documentId;
        if (existing.some((row) => row.documentId && row.documentId !== ownId)) {
          throw new errors.ValidationError(`Slug "${slug}" is already used by another static page in this language`);
        }
      }
    }
    return next();
  });
}

const LEGAL_PAGES_TABLE = 'legal_pages';
const STATIC_PAGES_TABLE = 'static_pages';

type MigrateStrapi = {
  db: {
    connection: {
      schema: {
        hasTable: (name: string) => Promise<boolean>;
        renameTable: (from: string, to: string) => Promise<void>;
      };
      raw: (sql: string) => Promise<unknown>;
    };
  };
  log: { info: (message: string) => void; warn: (message: string) => void };
};

/**
 * Renames the pre-v1 `legal-page` collection table and public permissions so
 * existing production data keeps working after the content type became
 * `static-page`.
 */
export async function migrateLegalPagesToStaticPages(strapi: MigrateStrapi) {
  const schema = strapi.db.connection.schema;
  try {
    const hasOld = await schema.hasTable(LEGAL_PAGES_TABLE);
    const hasNew = await schema.hasTable(STATIC_PAGES_TABLE);
    if (hasOld && !hasNew) {
      await schema.renameTable(LEGAL_PAGES_TABLE, STATIC_PAGES_TABLE);
      strapi.log.info(`Renamed DB table ${LEGAL_PAGES_TABLE} → ${STATIC_PAGES_TABLE}`);
    }
    const linkOld = `${LEGAL_PAGES_TABLE}_localizations_lnk`;
    const linkNew = `${STATIC_PAGES_TABLE}_localizations_lnk`;
    if ((await schema.hasTable(linkOld)) && !(await schema.hasTable(linkNew))) {
      await schema.renameTable(linkOld, linkNew);
      strapi.log.info(`Renamed DB table ${linkOld} → ${linkNew}`);
    }
  } catch (error) {
    strapi.log.warn(`Static pages DB migration skipped: ${String(error)}`);
  }

  try {
    await strapi.db.connection.raw(
      "UPDATE up_permissions SET action = replace(action, 'api::legal-page.legal-page', 'api::static-page.static-page') WHERE action LIKE '%legal-page%'",
    );
  } catch (error) {
    strapi.log.warn(`Static pages permission migration skipped: ${String(error)}`);
  }
}
