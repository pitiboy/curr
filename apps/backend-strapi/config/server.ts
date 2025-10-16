export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  logger: {
    level: 'debug',
    exposeInContext: true,
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});
