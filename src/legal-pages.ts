import MarkdownIt from 'markdown-it';

export const LEGAL_PAGE_UID = 'api::legal-page.legal-page';

/** Public HTML path prefix on the Strapi host (no /api, no login). */
export const LEGAL_PATH_PREFIX = '/legal';

/** Slugs the Google OAuth consent screen and the footers link to. */
export const LEGAL_SLUGS = {
  privacyPolicy: 'privacy-policy',
  termsOfService: 'terms-of-service',
  about: 'about',
} as const;

/** Content API actions opened to the users-permissions `public` role. */
export const LEGAL_PAGE_PUBLIC_ACTIONS = [
  'api::legal-page.legal-page.find',
  'api::legal-page.legal-page.findOne',
] as const;

/** Page languages. The first one is the default and the fallback. */
export const LEGAL_LOCALES = ['hu', 'en'] as const;
export type LegalLocale = (typeof LEGAL_LOCALES)[number];
export const DEFAULT_LEGAL_LOCALE: LegalLocale = 'hu';

/** i18n plugin locale rows the bootstrap makes sure exist. */
export const I18N_LOCALE_DEFS: Record<LegalLocale, { code: LegalLocale; name: string }> = {
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

const UI: Record<LegalLocale, UiStrings> = {
  hu: {
    siteName: 'KÖR – Közösségi Önjegyző Rendszer',
    updated: 'Utolsó módosítás',
    backoffice: 'Kezelő felület',
    indexTitle: 'Jogi dokumentumok',
    indexEmpty: 'Még nincs feltöltött dokumentum.',
    notFoundTitle: 'Nem található',
    notFoundBody: 'Ez a dokumentum még nincs feltöltve, vagy megváltozott a címe.',
    fallbackNotice: 'Ez az oldal még nem érhető el magyarul, ezért az alapnyelvi változatot látod.',
    fallbackTitle: 'Jogi dokumentum',
    switchLabel: 'Nyelv',
  },
  en: {
    siteName: 'KÖR – Community Unified Resource Registry',
    updated: 'Last updated',
    backoffice: 'Backoffice',
    indexTitle: 'Legal documents',
    indexEmpty: 'No documents have been published yet.',
    notFoundTitle: 'Not found',
    notFoundBody: 'This document has not been published yet, or its address has changed.',
    fallbackNotice:
      'This page is not available in English yet, so you are seeing the Hungarian version.',
    fallbackTitle: 'Legal document',
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

export type LegalPageRecord = {
  title?: string | null;
  slug?: string | null;
  body?: string | null;
  footer_order?: number | null;
  locale?: string | null;
  updatedAt?: string | Date | null;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidLegalSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && slug.length <= 128 && SLUG_PATTERN.test(slug);
}

/** `?locale=en` → `en`; anything unknown or missing → the default (`hu`). */
export function resolveLegalLocale(value: unknown): LegalLocale {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') {
    return DEFAULT_LEGAL_LOCALE;
  }
  const code = raw.trim().toLowerCase().slice(0, 2);
  return (LEGAL_LOCALES as readonly string[]).includes(code)
    ? (code as LegalLocale)
    : DEFAULT_LEGAL_LOCALE;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderLegalMarkdown(body: string) {
  return markdown.render(body ?? '');
}

/** `2026. 10. 16.` (hu) or `2026-10-16` (en) without relying on ICU data. */
export function formatLegalDate(
  value: string | Date | null | undefined,
  locale: LegalLocale = DEFAULT_LEGAL_LOCALE,
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

/** `/legal/privacy-policy` for hu (stable Google URL), `…?locale=en` for en. */
export function legalPagePath(slug?: string, locale: LegalLocale = DEFAULT_LEGAL_LOCALE) {
  const path = slug ? `${LEGAL_PATH_PREFIX}/${slug}` : LEGAL_PATH_PREFIX;
  return locale === DEFAULT_LEGAL_LOCALE ? path : `${path}?locale=${locale}`;
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
  locale: LegalLocale;
  /** Pages for the footer nav, already in the best available locale. */
  nav: LegalPageRecord[];
  /** Slug for the HU/EN switch; omitted on the index. */
  slug?: string;
};

function renderLanguageSwitch({ locale, slug }: RenderContext) {
  const items = LEGAL_LOCALES.map((code) =>
    code === locale
      ? `<strong lang="${code}">${code.toUpperCase()}</strong>`
      : `<a href="${escapeHtml(legalPagePath(slug, code))}" hreflang="${code}" lang="${code}">${code.toUpperCase()}</a>`,
  );
  return `<nav class="lang" aria-label="${UI[locale].switchLabel}">${items.join('')}</nav>`;
}

function renderFooterNav({ locale, nav }: RenderContext) {
  const links = nav
    .filter((page) => isValidLegalSlug(page.slug) && page.title)
    .map(
      (page) =>
        `<a href="${escapeHtml(legalPagePath(page.slug as string, locale))}">${escapeHtml(page.title as string)}</a>`,
    );
  links.push(`<a href="/backoffice/">${UI[locale].backoffice}</a>`);
  return `<nav>${links.join('')}</nav>`;
}

function renderDocument(title: string, content: string, ctx: RenderContext, contentLang?: string) {
  const ui = UI[ctx.locale];
  const alternates = ctx.slug
    ? LEGAL_LOCALES.map(
        (code) =>
          `<link rel="alternate" hreflang="${code}" href="${escapeHtml(legalPagePath(ctx.slug, code))}">`,
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
<header><a class="site" href="${escapeHtml(legalPagePath(undefined, ctx.locale))}">${escapeHtml(ui.siteName)}</a>${renderLanguageSwitch(ctx)}</header>
<main${mainLang}>
${content}
</main>
<footer>${renderFooterNav(ctx)}</footer>
</body>
</html>
`;
}

export function renderLegalPageHtml(
  page: LegalPageRecord,
  nav: LegalPageRecord[] = [],
  locale: LegalLocale = DEFAULT_LEGAL_LOCALE,
) {
  const ui = UI[locale];
  const title = page.title?.trim() || ui.fallbackTitle;
  const pageLocale = resolveLegalLocale(page.locale ?? locale);
  const isFallback = pageLocale !== locale;
  const updated = formatLegalDate(page.updatedAt, locale);
  const notice = isFallback ? `<p class="notice" lang="${locale}">${ui.fallbackNotice}</p>\n` : '';
  const meta = updated ? `<p class="meta" lang="${locale}">${ui.updated}: ${escapeHtml(updated)}</p>` : '';
  const slug = isValidLegalSlug(page.slug) ? page.slug : undefined;
  return renderDocument(
    title,
    `${notice}<h1>${escapeHtml(title)}</h1>\n${meta}\n${renderLegalMarkdown(page.body ?? '')}`,
    { locale, nav, slug },
    pageLocale,
  );
}

export function renderLegalIndexHtml(
  pages: LegalPageRecord[],
  locale: LegalLocale = DEFAULT_LEGAL_LOCALE,
) {
  const ui = UI[locale];
  const items = pages
    .filter((page) => isValidLegalSlug(page.slug) && page.title)
    .map(
      (page) =>
        `<li><a href="${escapeHtml(legalPagePath(page.slug as string, locale))}">${escapeHtml(page.title as string)}</a></li>`,
    );
  const list = items.length ? `<ul>${items.join('')}</ul>` : `<p>${ui.indexEmpty}</p>`;
  return renderDocument(ui.indexTitle, `<h1>${ui.indexTitle}</h1>\n${list}`, {
    locale,
    nav: pages,
  });
}

export function renderLegalNotFoundHtml(
  nav: LegalPageRecord[] = [],
  locale: LegalLocale = DEFAULT_LEGAL_LOCALE,
) {
  const ui = UI[locale];
  return renderDocument(ui.notFoundTitle, `<h1>${ui.notFoundTitle}</h1>\n<p>${ui.notFoundBody}</p>`, {
    locale,
    nav,
  });
}

type LegalDocuments = {
  findMany: (params?: Record<string, unknown>) => Promise<LegalPageRecord[]>;
  findFirst: (params?: Record<string, unknown>) => Promise<LegalPageRecord | null>;
};

export type LegalPagesStrapi = {
  documents: (uid: string) => LegalDocuments;
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
function localeChain(locale: LegalLocale): LegalLocale[] {
  return locale === DEFAULT_LEGAL_LOCALE ? [locale] : [locale, DEFAULT_LEGAL_LOCALE];
}

async function listForNav(strapi: LegalPagesStrapi, locale: LegalLocale) {
  const bySlug = new Map<string, LegalPageRecord>();
  for (const code of localeChain(locale)) {
    try {
      const rows = await strapi.documents(LEGAL_PAGE_UID).findMany({
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
      strapi.log?.warn(`Legal pages: list (${code}) failed: ${String(error)}`);
    }
  }
  return [...bySlug.values()].sort(
    (a, b) =>
      (a.footer_order ?? 0) - (b.footer_order ?? 0) ||
      String(a.title ?? '').localeCompare(String(b.title ?? '')),
  );
}

/** The page in the requested locale, or the default-locale (hu) version. */
export async function findLegalPage(
  strapi: LegalPagesStrapi,
  slug: string,
  locale: LegalLocale,
) {
  for (const code of localeChain(locale)) {
    const page = await strapi
      .documents(LEGAL_PAGE_UID)
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

export function createLegalPageHandlers(strapi: LegalPagesStrapi) {
  return {
    async index(ctx: HtmlContext) {
      const locale = resolveLegalLocale(ctx.query?.locale);
      const pages = await listForNav(strapi, locale);
      sendHtml(ctx, 200, renderLegalIndexHtml(pages, locale));
    },
    async show(ctx: HtmlContext) {
      const locale = resolveLegalLocale(ctx.query?.locale);
      const slug = ctx.params.slug;
      const nav = await listForNav(strapi, locale);
      if (!isValidLegalSlug(slug)) {
        sendHtml(ctx, 404, renderLegalNotFoundHtml(nav, locale));
        return;
      }
      const page = await findLegalPage(strapi, slug, locale);
      if (!page) {
        sendHtml(ctx, 404, renderLegalNotFoundHtml(nav, locale));
        return;
      }
      sendHtml(ctx, 200, renderLegalPageHtml(page, nav, locale));
    },
  };
}

/**
 * Public, server-rendered pages on the Strapi host, outside the /api prefix:
 * `/legal` (list) and `/legal/:slug`, both with an optional `?locale=en`.
 * Always reflect the current DB content, so no rebuild is needed after
 * editing a page in Strapi Admin.
 */
export function registerLegalPageRoutes(strapi: LegalPagesStrapi) {
  const handlers = createLegalPageHandlers(strapi);
  strapi.server.routes([
    {
      method: 'GET',
      path: LEGAL_PATH_PREFIX,
      handler: handlers.index,
      config: { auth: false },
    },
    {
      method: 'GET',
      path: `${LEGAL_PATH_PREFIX}/:slug`,
      handler: handlers.show,
      config: { auth: false },
    },
  ]);
}

/**
 * `PUBLIC_HOME_REDIRECT=/legal/about` turns the site root into the public
 * presentation page (Google OAuth "Application home page"). Unset: Strapi's
 * own `/` → `/admin` redirect stays. Only same-site paths are accepted.
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

export function registerHomeRedirect(
  strapi: { server: { use: (fn: unknown) => unknown }; log?: { info: (m: string) => void } },
  value: unknown = process.env.PUBLIC_HOME_REDIRECT,
) {
  const target = resolveHomeRedirect(value);
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

export type LegalLocalesStrapi = {
  plugin: (name: string) => { service: (name: string) => unknown } | undefined;
  log: { info: (message: string) => void; warn: (message: string) => void };
};

/**
 * Makes sure the hu and en i18n locales exist. hu becomes the default only
 * when this bootstrap is the one creating it, so a default chosen later in
 * Settings → Internationalization is never overridden on restart.
 */
export async function ensureLegalLocales(strapi: LegalLocalesStrapi) {
  const plugin = strapi.plugin('i18n');
  const locales = plugin?.service('locales') as LocalesService | undefined;
  if (!locales) {
    strapi.log.warn('Legal pages bootstrap: i18n plugin not available, locales skipped');
    return;
  }

  for (const code of LEGAL_LOCALES) {
    const existing = await locales.findByCode(code);
    if (existing) {
      continue;
    }
    await locales.create(I18N_LOCALE_DEFS[code]);
    strapi.log.info(`Created i18n locale "${code}"`);
    if (code === DEFAULT_LEGAL_LOCALE) {
      await locales.setDefaultLocale({ code });
      strapi.log.info(`Set default i18n locale to "${code}"`);
    }
  }
}
