export default {
  routes: [
    {
      method: 'GET',
      path: '/backoffice/config',
      handler: 'backoffice.config',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/backoffice/reconciliation',
      handler: 'backoffice.reconciliation',
      config: {
        policies: [],
      },
    },
  ],
};
