export default ({ env }) => {
  const isProduction = env('NODE_ENV') === 'production';

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    url: env('PUBLIC_URL', env('RENDER_EXTERNAL_URL', '')),
    proxy: env.bool('IS_PROXIED', isProduction),
    app: {
      keys: env.array('APP_KEYS'),
    },
    logger: isProduction
      ? {
          level: env('LOG_LEVEL', 'info'),
          exposeInContext: true,
        }
      : {
          level: env('LOG_LEVEL', 'debug'),
          exposeInContext: true,
          transport: {
            target: 'pino-pretty',
            options: { colorize: true },
          },
        },
  };
};
