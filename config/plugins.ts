export default ({ env }) => ({
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
  'users-permissions': {
    config: {
      grant: {
        google: {
          enabled: true,
          key: env('GOOGLE_CLIENT_ID', ''),
          secret: env('GOOGLE_CLIENT_SECRET', ''),
          callback: `${env('PUBLIC_URL', 'http://localhost:1337')}/api/connect/google/callback`,
          scope: ['email', 'profile'],
        },
      },
    },
  },
});
