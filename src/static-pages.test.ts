import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createHomeRedirectMiddleware,
  createStaticPageHandlers,
  ensureStaticPageLocales,
  formatStaticPageDate,
  isValidStaticPageSlug,
  STATIC_PAGE_UID,
  staticPagePath,
  registerHomeRedirect,
  registerStaticPageRoutes,
  renderStaticPageHtml,
  resolveHomeRedirect,
  resolveSiteHomeRedirectTarget,
  resolveStaticPageLocale,
  type StaticPageRecord,
  type StaticPagesStrapi,
} from './static-pages.ts';

const hu: StaticPageRecord[] = [
  {
    title: 'Adatkezelési tájékoztató',
    slug: 'privacy-policy',
    locale: 'hu',
    body: '## 1. Bevezetés\n\nA **KÖR** rendszer.\n\n- egy\n- kettő\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n',
    footer_order: 1,
    updatedAt: '2026-10-16T08:00:00.000Z',
  },
  {
    title: 'Felhasználási feltételek',
    slug: 'terms-of-service',
    locale: 'hu',
    body: 'x',
    footer_order: 2,
  },
];
const en: StaticPageRecord[] = [
  {
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    locale: 'en',
    body: '## 1. Intro',
    footer_order: 1,
  },
];

function fakeStrapi() {
  const routes: unknown[] = [];
  const byLocale: Record<string, StaticPageRecord[]> = { hu, en };
  const strapi: StaticPagesStrapi = {
    documents(uid) {
      assert.equal(uid, STATIC_PAGE_UID);
      return {
        findMany: async (params) =>
          byLocale[(params as { locale: string }).locale] ?? [],
        findFirst: async (params) => {
          const p = params as {
            locale: string;
            filters: { slug: { $eq: string } };
          };
          return (
            (byLocale[p.locale] ?? []).find(
              (page) => page.slug === p.filters.slug.$eq,
            ) ?? null
          );
        },
      };
    },
    server: {
      routes(input) {
        routes.push(...(input as unknown[]));
      },
    },
  };
  return { strapi, routes };
}

function fakeCtx(
  params: Record<string, string> = {},
  query: Record<string, unknown> = {},
) {
  const headers: Record<string, string> = {};
  return {
    params,
    query,
    status: 0,
    type: '',
    body: undefined as unknown,
    headers,
    set(field: string, value: string) {
      headers[field] = value;
    },
  };
}

describe('static pages', () => {
  it('accepts kebab-case slugs only', () => {
    assert.equal(isValidStaticPageSlug('privacy-policy'), true);
    assert.equal(isValidStaticPageSlug('Privacy'), false);
    assert.equal(isValidStaticPageSlug('../etc'), false);
    assert.equal(isValidStaticPageSlug(''), false);
    assert.equal(isValidStaticPageSlug(undefined), false);
  });

  it('resolves the locale query with hu as default', () => {
    assert.equal(resolveStaticPageLocale(undefined), 'hu');
    assert.equal(resolveStaticPageLocale('en'), 'en');
    assert.equal(resolveStaticPageLocale('EN-gb'), 'en');
    assert.equal(resolveStaticPageLocale(['en', 'hu']), 'en');
    assert.equal(resolveStaticPageLocale('de'), 'hu');
  });

  it('keeps the hu URL stable and adds ?locale for en', () => {
    assert.equal(staticPagePath('privacy-policy'), '/static/privacy-policy');
    assert.equal(
      staticPagePath('privacy-policy', 'en'),
      '/static/privacy-policy?locale=en',
    );
    assert.equal(staticPagePath(undefined, 'en'), '/static?locale=en');
  });

  it('formats dates per locale', () => {
    assert.equal(
      formatStaticPageDate('2026-10-16T08:00:00.000Z', 'hu'),
      '2026. 10. 16.',
    );
    assert.equal(
      formatStaticPageDate('2026-10-16T08:00:00.000Z', 'en'),
      '2026-10-16',
    );
    assert.equal(formatStaticPageDate('nope'), '');
  });

  it('renders markdown (headings, bold, lists, tables) and escapes raw HTML', () => {
    const html = renderStaticPageHtml({
      ...hu[0],
      body: `${hu[0].body}\n<script>alert(1)</script>\n`,
    });
    assert.match(html, /<html lang="hu">/);
    assert.match(html, /<h1>Adatkezelési tájékoztató<\/h1>/);
    assert.match(html, /<h2>1\. Bevezetés<\/h2>/);
    assert.match(html, /<strong>KÖR<\/strong>/);
    assert.match(html, /<li>egy<\/li>/);
    assert.match(html, /<table>/);
    assert.match(html, /Utolsó módosítás: 2026\. 10\. 16\./);
    assert.match(
      html,
      /<strong lang="hu">HU<\/strong><a href="\/static\/privacy-policy\?locale=en"/,
    );
    assert.equal(html.includes('<script>'), false);
    assert.match(html, /&lt;script&gt;/);
  });

  it('registers /static and /static/:slug without auth', () => {
    const { strapi, routes } = fakeStrapi();
    registerStaticPageRoutes(strapi);
    assert.deepEqual(
      routes.map((route) => {
        const r = route as { method: string; path: string; config: unknown };
        return [r.method, r.path, r.config];
      }),
      [
        ['GET', '/legal', { auth: false }],
        ['GET', '/legal/:slug', { auth: false }],
        ['GET', '/static', { auth: false }],
        ['GET', '/static/:slug', { auth: false }],
      ],
    );
  });

  it('serves hu by default, en on ?locale=en, and falls back to hu', async () => {
    const { strapi } = fakeStrapi();
    const handlers = createStaticPageHandlers(strapi);

    const huCtx = fakeCtx({ slug: 'privacy-policy' });
    await handlers.show(huCtx);
    assert.equal(huCtx.status, 200);
    assert.equal(huCtx.type, 'text/html; charset=utf-8');
    assert.match(String(huCtx.body), /<h1>Adatkezelési tájékoztató<\/h1>/);
    assert.match(String(huCtx.body), /href="\/static\/terms-of-service"/);

    const enCtx = fakeCtx({ slug: 'privacy-policy' }, { locale: 'en' });
    await handlers.show(enCtx);
    assert.equal(enCtx.status, 200);
    assert.match(String(enCtx.body), /<html lang="en">/);
    assert.match(String(enCtx.body), /<h1>Privacy Policy<\/h1>/);
    // nav: en title where it exists, hu fallback otherwise, links stay in en
    assert.match(
      String(enCtx.body),
      /href="\/static\/terms-of-service\?locale=en">Felhasználási feltételek/,
    );

    const fallback = fakeCtx({ slug: 'terms-of-service' }, { locale: 'en' });
    await handlers.show(fallback);
    assert.equal(fallback.status, 200);
    assert.match(String(fallback.body), /not available in English yet/);
    assert.match(String(fallback.body), /<main lang="hu">/);

    const missing = fakeCtx({ slug: 'cookie-policy' });
    await handlers.show(missing);
    assert.equal(missing.status, 404);

    const invalid = fakeCtx({ slug: 'A B' });
    await handlers.show(invalid);
    assert.equal(invalid.status, 404);

    const index = fakeCtx({}, { locale: 'en' });
    await handlers.index(index);
    assert.equal(index.status, 200);
    assert.match(
      String(index.body),
      /href="\/static\/privacy-policy\?locale=en">Privacy Policy/,
    );
  });

  it('creates missing locales and makes hu default only when it creates hu', async () => {
    const existing = new Set(['en']);
    const calls: string[] = [];
    const strapi = {
      plugin: () => ({
        service: () => ({
          findByCode: async (code: string) =>
            existing.has(code) ? { id: 1, code } : null,
          create: async ({ code }: { code: string }) => {
            existing.add(code);
            calls.push(`create:${code}`);
          },
          setDefaultLocale: async ({ code }: { code: string }) => {
            calls.push(`default:${code}`);
          },
        }),
      }),
      log: { info() {}, warn() {} },
    };
    await ensureStaticPageLocales(strapi);
    assert.deepEqual(calls, ['create:hu', 'default:hu']);
    calls.length = 0;
    await ensureStaticPageLocales(strapi);
    assert.deepEqual(calls, []);
  });

  it('accepts only same-site home redirect paths', () => {
    assert.equal(resolveHomeRedirect('/static/about'), '/static/about');
    assert.equal(resolveHomeRedirect(' /static/about '), '/static/about');
    assert.equal(resolveHomeRedirect(undefined), null);
    assert.equal(resolveHomeRedirect(''), null);
    assert.equal(resolveHomeRedirect('/'), null);
    assert.equal(resolveHomeRedirect('//evil.example'), null);
    assert.equal(resolveHomeRedirect('https://evil.example'), null);
  });

  it('activates home redirect only when PUBLIC_HOME_REDIRECT is set', () => {
    assert.equal(resolveSiteHomeRedirectTarget(undefined), null);
    assert.equal(resolveSiteHomeRedirectTarget('/backoffice/'), '/backoffice/');
  });

  it('redirects only GET / and keeps the query', async () => {
    const used: unknown[] = [];
    assert.equal(
      registerHomeRedirect(
        { server: { use: (fn) => used.push(fn) } },
        undefined,
      ),
      false,
    );
    assert.equal(used.length, 0);
    assert.equal(
      registerHomeRedirect(
        { server: { use: (fn) => used.push(fn) } },
        '/backoffice/',
      ),
      true,
    );
    assert.equal(used.length, 1);
    assert.equal(
      registerHomeRedirect({ server: { use: (fn) => used.push(fn) } }, ''),
      false,
    );

    const mw = createHomeRedirectMiddleware('/static/about');
    let redirected = '';
    let nextCalled = false;
    await mw(
      {
        method: 'GET',
        path: '/',
        querystring: 'locale=en',
        redirect: (u) => (redirected = u),
      },
      async () => {
        nextCalled = true;
      },
    );
    assert.equal(redirected, '/static/about?locale=en');
    assert.equal(nextCalled, false);

    await mw(
      { method: 'GET', path: '/admin', redirect: () => assert.fail() },
      async () => {
        nextCalled = true;
      },
    );
    assert.equal(nextCalled, true);
  });
});
