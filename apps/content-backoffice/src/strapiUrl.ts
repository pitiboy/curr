/** Strapi origin without path (see `.env.example`). */
export function resolveStrapiUrl(options: {
  dev: boolean;
  viteStrapiUrl?: string;
  windowOrigin?: string;
}): string {
  const fromEnv = options.viteStrapiUrl?.trim();
  if (options.dev) {
    return fromEnv || 'http://localhost:1337';
  }
  const fromWindow = options.windowOrigin?.trim();
  if (fromWindow) {
    return fromWindow;
  }
  return fromEnv || 'http://localhost:1337';
}
