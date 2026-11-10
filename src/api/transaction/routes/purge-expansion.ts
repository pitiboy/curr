/**
 * Controller-only: delete every expanded + storno child of an `original`
 * transaction (receipts cascaded) and reset the source to expandable.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/transactions/:id/actions/purge-expansion',
      handler: 'transaction.purgeExpansion',
      config: {
        auth: {
          scope: ['api::transaction.transaction.purgeExpansion'],
        },
      },
    },
  ],
};
