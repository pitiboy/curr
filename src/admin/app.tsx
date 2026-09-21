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
        'content-manager.containers.Edit.pluginHeader.title.new':
          'Új bejegyzés',
      },
      en: {
        // English translations (optional overrides)
        'content-manager.components.LeftMenu.collection-types':
          'Collection Types',
        'content-manager.components.LeftMenu.single-types': 'Single Types',
      },
    },
  },
  bootstrap(app: StrapiApp) {
    // You can add custom admin panel logic here
  },
};
