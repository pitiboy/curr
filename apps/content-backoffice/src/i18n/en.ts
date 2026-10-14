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
    transactions_none: 'No transactions.',
    transactions_create_empty: 'The form is built in plan step 6.',
    transactions_review_empty: 'Draft list and publish arrive in plan step 8.',
    profile: 'Profile',
    profile_name: 'Name',
    profile_email: 'Email',
    feature_flags: 'Feature flags',
    feature_flags_empty: 'No workflows to toggle.',
    feature_flags_reset: 'Use server list',
    login_google: 'Sign in with Google (coming soon)',
    status: {
      draft: 'Draft',
      published: 'Published',
    },
    filters: {
      status_all: 'All',
      date_from: 'Date from',
      date_to: 'Date to',
      amount_from: 'Amount from',
      amount_to: 'Amount to',
    },
    receipt_yes: 'Yes',
    receipt_no: 'No',
  },
  resources: {
    transactions: {
      name: 'Transaction |||| Transactions',
      fields: {
        date: 'Date',
        amount: 'Amount',
        description: 'Description',
        organization: 'Organization',
        debit_account: 'Debit',
        credit_account: 'Credit',
        status: 'Status',
        receipt: 'Receipt',
      },
    },
    organizations: {
      name: 'Organization |||| Organizations',
      fields: {
        name: 'Name',
      },
    },
    accounts: {
      name: 'Account |||| Accounts',
      fields: {
        name: 'Name',
        code: 'Code',
      },
    },
  },
});
