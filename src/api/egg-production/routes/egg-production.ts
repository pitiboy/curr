/**
 * Napi tojás űrlap: termelés + készlet átvezetés + továbbosztás egy kérésben.
 * Jogosultság: `api::egg-production.egg-production.createEntries` (minden
 * content szerep, lásd `src/content-roles.ts`); a feature flaget, a szerepet
 * és a szervezeti hatókört a service ellenőrzi.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/egg-production/entries',
      handler: 'egg-production.createEntries',
      config: {
        policies: [],
      },
    },
  ],
};
