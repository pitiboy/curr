import englishMessages from 'ra-language-english';
import { mergeTranslations } from 'react-admin';

/** English message catalog (react-admin + app labels). */
export const enMessages = mergeTranslations(englishMessages, {
  app: {
    title: 'Backoffice',
    menu_placeholder: 'No menu items',
    transactions_list: 'Transactions',
    transactions_create: 'New transaction',
    transactions_review: 'Review',
    transactions_none: 'No transactions.',
    transactions_review_empty: 'No drafts.',
    transactions_review_hint:
      'Open the draft receipts from here. Attaching a new file is optional.',
    accounts_seed_missing:
      'The account list is empty because the seed is missing.',
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
    receipt_block: 'Receipt',
    receipt_optional:
      'The receipt can be skipped. Without a file, no receipt is created.',
    receipt_file: 'File',
    receipt_clear: 'Remove file',
    receipt_skip: 'No file attached.',
    receipt_vendor: 'Vendor',
    receipt_vendor_hint: 'A vendor is required when a file is attached.',
    receipt_type: 'Receipt type',
    receipt_add: 'New receipt',
    receipt_remove: 'Remove',
    receipt_card_required:
      'A vendor and a receipt type are required when a file is attached.',
    receipt_prefill:
      'Date, amount, and description are copied from the transaction.',
    receipt_description_required:
      'A description is required when a file is attached.',
    receipt_open: 'Open',
    receipt_save: 'Save receipt',
    receipt_saved: 'Receipt saved.',
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
        currency_type: 'Currency',
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
