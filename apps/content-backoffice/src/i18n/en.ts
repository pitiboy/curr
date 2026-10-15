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
    transactions_show: 'View',
    transactions_none: 'No transactions.',
    transactions_finalize: 'Finalize',
    transactions_finalized: 'Transaction finalized.',
    transactions_finalize_hint:
      'This transaction is not finalized yet, which means it will not appear in financial statements. Once you have reviewed and found the data and attached receipts to be correct, finalize the transaction and its receipts.',
    transactions_finalize_no_receipt:
      'This transaction has no attached receipt. After finalizing, a receipt can no longer be uploaded, so finalize only if you are sure that no expected receipt will arrive.',
    transactions_finalize_pending:
      'The attached file is not saved yet. Save the receipt first.',
    transactions_finalize_same_person:
      'Changes were saved and the transaction stayed a draft. The person who entered it cannot finalize it.',
    transactions_leave_title: 'This transaction is still a draft',
    transactions_leave_body: 'Finalizing is still pending. Leave this page?',
    transactions_leave_unsaved_title: 'This transaction is not saved yet',
    transactions_leave_unsaved_body:
      'The data you entered will be lost. Leave this page?',
    transactions_leave_go: 'Leave',
    transactions_leave_stay: 'Stay',
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
      clear: 'Clear filters',
      date_from: 'Date from',
      date_to: 'Date to',
      created_from: 'Created from',
      created_to: 'Created to',
      amount_from: 'Amount from',
      amount_to: 'Amount to',
    },
    receipt_yes: 'Yes',
    receipt_no: 'No',
    receipt_block: 'Receipts',
    receipt_optional:
      'The receipt can be skipped. Without a file, no receipt is created.',
    receipt_drop: 'Drop a file here, or click to browse.',
    receipt_clear: 'Remove file',
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
        createdAt: 'Created',
        entered_by: 'Entered by',
        published_by: 'Published by',
        publishedAt: 'Published at',
        amount: 'Amount',
        description: 'Description',
        organization: 'Organization',
        debit_account: 'Debit',
        credit_account: 'Credit',
        currency_type: 'Currency',
        vendor: 'Vendor',
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
