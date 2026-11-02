export default {
  routes: [
    {
      method: 'POST',
      path: '/transaction-workflows/convert',
      handler: 'transaction-workflow.convert',
      config: {
        auth: {
          scope: ['api::transaction-workflow.transaction-workflow.convert'],
        },
      },
    },
  ],
};
