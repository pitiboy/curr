import englishMessages from 'ra-language-english';
import { mergeTranslations } from 'react-admin';

/** English message catalog (react-admin + app labels). */
export const enMessages = mergeTranslations(englishMessages, {
  app: {
    title: 'Content backoffice',
    menu_placeholder: 'No menu items',
    transactions_list: 'Transactions',
    transactions_create: 'New transaction',
    transactions_review: 'Review',
    transactions_list_empty: 'Transaction data arrives in plan step 4.',
    transactions_create_empty: 'The form is built in plan step 6.',
    transactions_review_empty: 'Draft list and publish arrive in plan step 8.',
    profile: 'Profile',
    profile_name: 'Name',
    profile_email: 'Email',
    login_google: 'Sign in with Google (coming soon)',
  },
});
