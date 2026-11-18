/**
 * Voice-driven transaction entry: transcript → validated draft form values.
 * Saves nothing; the user reviews the form and saves it manually.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/transactions/parse-voice',
      handler: 'transaction.parseVoice',
      config: {
        auth: {
          scope: ['api::transaction.transaction.parseVoice'],
        },
      },
    },
  ],
};
