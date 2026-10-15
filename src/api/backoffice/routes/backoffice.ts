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
  ],
};
