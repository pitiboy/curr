/** Strapi origin without path. Dev: local Strapi; prod: same origin as the SPA. */
export function resolveStrapiUrl(options: {
  dev: boolean;
  windowOrigin?: string;
}): string {
  if (options.dev) {
    return 'http://localhost:1337';
  }
  const fromWindow = options.windowOrigin?.trim();
  return fromWindow || 'http://localhost:1337';
}
