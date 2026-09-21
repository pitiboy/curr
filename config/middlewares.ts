export default ({ env }) => {
  const isProduction = env('NODE_ENV') === 'production';
  const origins = [
    env('PUBLIC_URL'),
    env('RENDER_EXTERNAL_URL'),
    ...(env('CORS_ORIGINS', '')
      .split(',')
      .map((origin: string) => origin.trim())
      .filter(Boolean)),
  ].filter(Boolean);

  return [
    'strapi::logger',
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'connect-src': ["'self'", 'https:'],
            'img-src': [
              "'self'",
              'data:',
              'blob:',
              'res.cloudinary.com',
              '*.cloudinary.com',
            ],
            'media-src': [
              "'self'",
              'data:',
              'blob:',
              'res.cloudinary.com',
              '*.cloudinary.com',
            ],
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    isProduction && origins.length > 0
      ? {
          name: 'strapi::cors',
          config: {
            origin: origins,
            credentials: true,
          },
        }
      : 'strapi::cors',
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
