export default {
  rest: {
    defaultLimit: 25,
    maxLimit: 100,
    withCount: true,
  },
  documents: {
    // Required relations are checked on publish. Draft saves still skip them;
    // the publish guard rejects an incomplete transaction write.
    strictRelations: true,
  },
};
