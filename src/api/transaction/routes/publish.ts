/**
 * Content API publish. The scope stays on `update`: there is no separate
 * permission. The publish guard allows only an editor who did not enter
 * the document.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/transactions/:id/actions/publish',
      handler: 'transaction.publish',
      config: {
        auth: {
          scope: ['api::transaction.transaction.update'],
        },
      },
    },
  ],
};
