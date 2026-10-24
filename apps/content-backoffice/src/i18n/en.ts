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
    description_clear_comments: 'Remove comments',
    transactions_finalized: 'Transaction finalized.',
    transactions_bulk_finalize: 'Finalize',
    transactions_bulk_finalize_title:
      'Finalize %{smart_count} transaction |||| Finalize %{smart_count} transactions',
    transactions_bulk_finalize_body:
      'Selected transactions and receipts stay unchanged. Only the publish action runs.',
    transactions_bulk_finalize_body_partial:
      '%{ready} transaction(s) will be finalized. %{skipped} selection(s) will be skipped (incomplete data, or entered by you — you cannot publish your own entries).',
    transactions_bulk_finalize_body_partial_no_self_block:
      '%{ready} transaction(s) will be finalized. %{skipped} selection(s) will be skipped (incomplete data or not eligible to finalize).',
    transactions_bulk_finalize_confirm: 'Finalize',
    transactions_bulk_done:
      '%{smart_count} transaction finalized. |||| %{smart_count} transactions finalized.',
    transactions_bulk_incomplete:
      '%{smart_count} selected row is incomplete and cannot be finalized. |||| %{smart_count} selected rows are incomplete and cannot be finalized.',
    transactions_bulk_same_person:
      '%{smart_count} selected row was entered by you and cannot be finalized. |||| %{smart_count} selected rows were entered by you and cannot be finalized.',
    transactions_bulk_skipped_incomplete:
      'Skipped %{smart_count} incomplete transaction. |||| Skipped %{smart_count} incomplete transactions.',
    transactions_bulk_skipped_same_person:
      'Skipped %{smart_count} transaction you entered. |||| Skipped %{smart_count} transactions you entered.',
    transactions_bulk_failed:
      'Failed to finalize %{smart_count} transaction. |||| Failed to finalize %{smart_count} transactions.',
    transactions_bulk_none_ready:
      'None of the selected transactions can be finalized.',
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
    profile_role: 'Role',
    roles: {
      editor: 'Editor',
      dataentry: 'Data entry',
      authenticated: 'Authenticated user',
    },
    profile_password_heading: 'Change password',
    profile_password_current: 'Current password',
    profile_password_new: 'New password',
    profile_password_confirm: 'Confirm new password',
    profile_password_submit: 'Save password',
    profile_password_success: 'Password updated.',
    profile_password_mismatch: 'New passwords do not match.',
    profile_password_error: 'Could not change password.',
    feature_flags: 'Feature flags',
    feature_flags_empty: 'No workflows to toggle.',
    feature_flags_reset: 'Use server list',
    workflows: {
      'egg-daily-entry': 'Daily egg entry',
      'member-fee': 'Member fee',
    },
    bulk_quantity: {
      save: 'Save',
      catalog_missing:
        'Required master data is missing (hen house, account, currency, or transaction type).',
      no_hen_houses: 'No hen houses found under the parent organization.',
      no_rows: 'Enter at least one non-zero quantity.',
      invalid_quantity: 'Whole number, 0 or greater.',
      results_heading: 'Save results',
      retry_failed: 'Retry failed rows',
      conflict_title: 'Entry already exists for this day',
      conflict_body:
        'A transaction already exists for the same day, hen house, and account pair. Choose what to do for each row.',
      conflict_existing: 'Existing amount: %{amount}',
      conflict_update: 'Update existing row',
      conflict_insert: 'Insert as new row',
      conflict_continue: 'Continue',
      conflict_global_body:
        'Entries already exist for this day (production or distribution). The choice below applies to every affected row.',
      step_production: 'Production',
      step_distribution: 'Distribution',
      next_distribution: 'Next: distribution',
      back_production: 'Back: production',
      save_production_only: 'Save production only',
      save_production_and_distribution: 'Save production and distribution',
      distribution_produced: 'Total produced today: %{count}',
      distribution_remaining: 'Still unallocated: %{count}',
      distribution_over_limit:
        'Distributed quantity cannot exceed total production.',
      distribution_rate:
        'Rate (%{from} → %{to}): %{rate}, valid since %{date}',
      distribution_rate_missing:
        'No %{from} → %{to} rate for the selected day; sale rows cannot be saved.',
      distribution_no_members:
        'No members in organization “%{org}” for this date.',
      distribution_members_failed: 'Could not load the member list.',
      description: {
        egg: 'Daily eggs — %{organization}: %{amount}',
        egg_distribution_internal:
          'Egg distribution (internal) — %{member}: %{amount}',
        egg_distribution_stock:
          'Egg distribution (stock) — %{member}: %{amount}',
        egg_distribution_revenue:
          'Egg distribution (revenue) — %{member}: %{amount} → %{revenue}',
      },
    },
    login_google: 'Sign in with Google',
    oauth_errors: {
      register_not_available:
        'There is no user for this Google account. Ask an administrator to add you with this email address.',
      ambiguous_email:
        'Several users share this email address. Ask an administrator to sort it out.',
      account_blocked: 'Your account has been blocked by an administrator.',
      email_not_confirmed: 'Your account email is not confirmed yet.',
      email_not_available:
        'Google did not share your email address, so you cannot be signed in.',
      email_taken: 'This email address already belongs to another account.',
      session_missing: 'The Google sign-in was interrupted. Please try again.',
      provider_disabled: 'Google sign-in is currently turned off.',
    },
    static_nav: 'Static pages',
    static_privacy: 'Privacy Policy',
    static_terms: 'Terms of Service',
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
