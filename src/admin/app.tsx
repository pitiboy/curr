import type { StrapiApp } from '@strapi/strapi/admin';

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
