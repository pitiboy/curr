export default {
  rest: {
    defaultLimit: 25,
    maxLimit: 100,
    withCount: true,
  },
  documents: {
    // Required relations are checked on publish. Draft HTTP writes still skip
    // them; the publish guard requires date, amount, currency_type and
    // description on draft, and all seven fields on the stored draft at publish.
    strictRelations: true,
  },
};
