const backofficeCallbackPath = '/backoffice/';

export default ({ env }) => ({
  'users-permissions': {
    config: {
      grant: {
        google: {
          enabled: true,
          key: env('GOOGLE_CLIENT_ID', ''),
          secret: env('GOOGLE_CLIENT_SECRET', ''),
          callback: env(
            'BACKOFFICE_OAUTH_CALLBACK',
            'http://localhost:5173/backoffice/',
          ),
        },
      },
      callback: {
        validate(callback: string, provider: { callback?: string }) {
          let callbackUrl: URL;
          try {
            callbackUrl = new URL(callback);
          } catch {
            throw new Error('The callback is not a valid URL');
          }

          const allowedOrigins = new Set<string>();
          const configuredCallback = env(
            'BACKOFFICE_OAUTH_CALLBACK',
            'http://localhost:5173/backoffice/',
          );
          allowedOrigins.add(new URL(configuredCallback).origin);
          allowedOrigins.add('http://localhost:5173');

          const publicUrl = env('PUBLIC_URL', '');
          if (publicUrl) {
            allowedOrigins.add(new URL(publicUrl).origin);
          }
          allowedOrigins.add('https://kor.fejlesztesek.hu');
          allowedOrigins.add('https://edizone.fejlesztesek.hu');

          if (provider?.callback) {
            allowedOrigins.add(new URL(provider.callback).origin);
          }

          if (!allowedOrigins.has(callbackUrl.origin)) {
            throw new Error(
              'Forbidden callback provided: origins do not match. Please verify your config.',
            );
          }

          const normalizedPath =
            callbackUrl.pathname.endsWith('/') && callbackUrl.pathname.length > 1
              ? callbackUrl.pathname
              : `${callbackUrl.pathname}/`;

          if (normalizedPath !== backofficeCallbackPath) {
            throw new Error(
              'Forbidden callback provided: pathname does not match. Please verify your config.',
            );
          }
        },
      },
    },
  },
  upload: {
    config: {
      provider: 'cloudinary',
      providerOptions: {
        cloud_name: env('CLOUDINARY_NAME'),
        api_key: env('CLOUDINARY_KEY'),
        api_secret: env('CLOUDINARY_SECRET'),
      },
      actionOptions: {
        upload: {
          // Use upload preset if specified
          upload_preset: env('CLOUDINARY_UPLOAD_PRESET'),
          // Optional: Set folder for organization
          folder: env('CLOUDINARY_FOLDER', 'strapi-uploads'),
        },
        uploadStream: {
          upload_preset: env('CLOUDINARY_UPLOAD_PRESET'),
          folder: env('CLOUDINARY_FOLDER', 'strapi-uploads'),
        },
        delete: {},
      },
    },
  },
  'strapi-schema-extender': {
    enabled: true,
  },
});
