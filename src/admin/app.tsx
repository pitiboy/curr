import type { StrapiApp } from '@strapi/strapi/admin';

/**
 * Public legal pages served by Strapi itself (src/legal-pages.ts). Same origin
 * as the admin, so the links work locally (:1337) and on kor.fejlesztesek.hu.
 * hu is the default page language; en adds `?locale=en`.
 */
const LEGAL_LINKS = {
  hu: [
    { href: '/legal/privacy-policy', label: 'Adatkezelési tájékoztató' },
    { href: '/legal/terms-of-service', label: 'Felhasználási feltételek' },
  ],
  en: [
    { href: '/legal/privacy-policy?locale=en', label: 'Privacy Policy' },
    { href: '/legal/terms-of-service?locale=en', label: 'Terms of Service' },
  ],
} as const;

const LEGAL_FOOTER_ID = 'kor-legal-footer';
const BACKOFFICE_ENTRY_ID = 'kor-backoffice-entry';

const BACKOFFICE_ENTRY_LABELS = {
  hu: 'Kezelő felület',
  en: 'Backoffice',
} as const;

/**
 * The admin keeps its UI language on `<html lang>` (login dropdown and
 * profile setting both update it). Anything other than hu gets the en pages.
 */
function adminLegalLocale(): keyof typeof LEGAL_LINKS {
  const lang = (document.documentElement.lang || 'en').toLowerCase();
  return lang.startsWith('hu') ? 'hu' : 'en';
}

function renderLegalFooter(footer: HTMLElement) {
  const locale = adminLegalLocale();
  if (footer.dataset.locale === locale) {
    return;
  }
  footer.dataset.locale = locale;
  footer.replaceChildren();

  for (const link of LEGAL_LINKS[locale]) {
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.textContent = link.label;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.hreflang = locale;
    Object.assign(anchor.style, {
      color: '#8A62B0',
      textDecoration: 'none',
    });
    footer.appendChild(anchor);
  }
}

/**
 * Strapi 5 has no footer slot or login-page injection zone, so a small fixed
 * strip is appended to <body> once. It stays mounted across the admin SPA
 * routes, so it shows on the login screen and after login alike, and follows
 * the admin language.
 */
function isAdminLoginRoute() {
  return /\/auth\/login\/?$/.test(window.location.pathname);
}

/**
 * Strapi has no login-page slot; a fixed entry on the auth screen sends editors
 * and dataentry users to the content backoffice SPA at /backoffice/.
 */
function mountBackofficeEntry() {
  if (document.getElementById(BACKOFFICE_ENTRY_ID)) {
    return;
  }

  const wrap = document.createElement('div');
  wrap.id = BACKOFFICE_ENTRY_ID;
  Object.assign(wrap.style, {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: '10000',
    display: 'none',
  });

  const link = document.createElement('a');
  link.href = '/backoffice/';
  link.setAttribute('aria-label', BACKOFFICE_ENTRY_LABELS.hu);
  Object.assign(link.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '999px',
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: 'inherit',
    color: '#fff',
    background: '#8A62B0',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
    textDecoration: 'none',
  });

  const plus = document.createElement('span');
  plus.textContent = '+';
  plus.setAttribute('aria-hidden', 'true');
  Object.assign(plus.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.22)',
    fontSize: '18px',
    lineHeight: '1',
  });

  const label = document.createElement('span');
  label.className = 'kor-backoffice-entry-label';

  link.append(plus, label);
  wrap.append(link);
  document.body.append(wrap);

  const sync = () => {
    const locale = adminLegalLocale();
    const text = BACKOFFICE_ENTRY_LABELS[locale];
    label.textContent = text;
    link.setAttribute('aria-label', text);
    wrap.style.display = isAdminLoginRoute() ? 'block' : 'none';
  };

  sync();
  window.addEventListener('popstate', sync);
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    history[method] = (...args: Parameters<History['pushState']>) => {
      const result = original(...args);
      sync();
      return result;
    };
  }
  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang'],
  });
}

function mountLegalFooter() {
  if (document.getElementById(LEGAL_FOOTER_ID)) {
    return;
  }

  const footer = document.createElement('div');
  footer.id = LEGAL_FOOTER_ID;
  footer.setAttribute('role', 'contentinfo');
  Object.assign(footer.style, {
    position: 'fixed',
    bottom: '0',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '1',
    display: 'flex',
    gap: '12px',
    padding: '2px 10px',
    fontSize: '11px',
    lineHeight: '16px',
    fontFamily: 'inherit',
    borderRadius: '4px 4px 0 0',
    background: 'rgba(127, 127, 127, 0.12)',
  });

  renderLegalFooter(footer);
  document.body.appendChild(footer);

  new MutationObserver(() => renderLegalFooter(footer)).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ['lang'] },
  );
}

export default {
  config: {
    locales: ['hu', 'en'],
    theme: {
      light: {
        colors: {
          success100: '#EDF4F0',
          success200: '#BBD7C7',
          success500: '#549B74',
          success600: '#1B7A45',
          success700: '#145C34',
          primary100: '#EEF4FA',
          primary200: '#BFD4EC',
          primary500: '#5F93CF',
          primary600: '#2A6FBF',
          primary700: '#1D4E86',
          secondary100: '#EEF4FA',
          secondary200: '#BFD4EC',
          secondary500: '#5F93CF',
          secondary600: '#2A6FBF',
          secondary700: '#1D4E86',
          buttonPrimary600: '#8A62B0',
          buttonPrimary500: '#A283C4',
        },
      },
      dark: {
        colors: {
          success100: '#123224',
          success200: '#1B7A45',
          success500: '#3D9A62',
          success600: '#54B07A',
          success700: '#8FCBAA',
          primary100: '#10243A',
          primary200: '#1D4E86',
          primary500: '#3D86C9',
          primary600: '#5F93CF',
          primary700: '#BFD4EC',
          secondary100: '#10243A',
          secondary200: '#1D4E86',
          secondary500: '#3D86C9',
          secondary600: '#5F93CF',
          secondary700: '#BFD4EC',
          buttonPrimary600: '#8A62B0',
          buttonPrimary500: '#A283C4',
        },
      },
    },
    translations: {
      hu: {
        // Content Manager - General UI (these work for UI elements)
        'content-manager.components.LeftMenu.collection-types':
          'Gyűjtemény típusok',
        'content-manager.components.LeftMenu.single-types': 'Egyedi típusok',
        'content-manager.containers.ListPage.displayedFields':
          'Megjelenített mezők',
        'content-manager.containers.Edit.pluginHeader.title.new': 'Új',
        'content-manager.containers.Edit.pluginHeader.title.edit':
          'Szerkesztés',
        'content-manager.containers.Edit.pluginHeader.title': 'Szerkesztés',
        'content-manager.popUpWarning.bodyMessage.contentType.delete':
          'Biztosan törölni szeretnéd ezt a bejegyzést?',
        'Auth.form.welcome.title': 'Üdvözöl a KÖR!',
        'Auth.form.welcome.subtitle': 'Lépj be a Közösségi Önjegyző Rendszerbe',
        'Auth.form.button.login': 'Bejelentkezés',
        'Auth.link.forgot-password': 'Elfelejtetted a jelszavad?',
        'HomePage.header.title': 'Szia {name}!',
        'HomePage.header.subtitle': 'Ez a KÖR, a Közösségi Önjegyző Rendszer',
      },
      en: {
        // English translations (optional overrides)
        'content-manager.components.LeftMenu.collection-types':
          'Collection Types',
        'content-manager.components.LeftMenu.single-types': 'Single Types',
        'Auth.form.welcome.title': 'Welcome to CURR!',
        'Auth.form.welcome.subtitle':
          'Log in to the Community Unified Resource Registry',
        'HomePage.header.title': 'Hello, {name}',
        'HomePage.header.subtitle':
          'This is the CURR, the Community Unified Resource Registry',
      },
    },
  },
  bootstrap(_app: StrapiApp) {
    mountBackofficeEntry();
    mountLegalFooter();

    const titlePrefix = 'KÖR | ';

    const prefixDocumentTitle = () => {
      if (!document.title.startsWith(titlePrefix)) {
        document.title = `${titlePrefix}${document.title}`;
      }
    };

    prefixDocumentTitle();

    const titleEl = document.querySelector('title');
    if (titleEl) {
      new MutationObserver(prefixDocumentTitle).observe(titleEl, {
        childList: true,
      });
    }
  },
};
