import MemberAccountField from './components/MemberAccountField';

export default {
  config: {
    locales: ['hu', 'en'],
  },
  bootstrap(app) {
    // Register custom field component
    app.addField({ type: 'member-account', Component: MemberAccountField });

    app.registerPlugin({
      id: 'member-account-field',
      name: 'member-account-field',
      isReady: true,
    });
  },
};
