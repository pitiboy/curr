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
});
