import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: ['hu', 'en'],
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
