/** Editor-only discard of a draft transaction (not generic delete). */
export default {
  routes: [
    {
      method: 'POST',
      path: '/transactions/:id/actions/discard-draft',
      handler: 'transaction.discardDraft',
      config: {
        auth: {
          scope: ['api::transaction.transaction.discardDraft'],
        },
      },
    },
  ],
};
