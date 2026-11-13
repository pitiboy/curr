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
    transactions_convert: 'Expand deal',
    transactions_convert_save: 'Save and expand deal',
    transactions_convert_title: 'Expand deal: %{name}',
    transactions_convert_body:
      'This will create template rows from the transaction (storno / steps). Continue?',
    transactions_convert_confirm: 'Expand',
    transactions_convert_done: 'Deal expanded.',
    transactions_convert_error: 'Could not expand the deal.',
    transactions_convert_organization_required:
      'This transaction template requires an organization.',
    transactions_convert_ambiguous:
      'More than one deal template matches this transaction.',
    transactions_convert_preview: 'Preview expansion',
    transactions_convert_preview_loading: 'Loading preview…',
    transactions_convert_preview_error: 'Could not load the preview.',
    transactions_convert_preview_empty: 'No preview to show.',
    transactions_convert_preview_disabled:
      'Fill in date, amount, currency, and debit/credit accounts first.',
    transactions_convert_preview_keep_original:
      'Original row is kept (storno + steps)',
    transactions_convert_preview_delete_original: 'Original row is deleted',
    transactions_convert_preview_steps_published:
      'Generated steps are published',
    transactions_convert_preview_steps_draft: 'Generated steps stay draft',
    transactions_convert_preview_legend:
      'Arrow direction: credit account → debit account.',
    transactions_convert_preview_sequence_legend:
      'Sequence diagram: accounts as headers with lifelines; messages top-to-bottom — arrow credit → debit.',
    transactions_convert_preview_diagram_aria: 'Account movements: %{summary}',
    transactions_convert_preview_kind: 'Kind',
    transactions_convert_preview_kind_original: 'Original',
    transactions_convert_preview_kind_storno: 'Storno',
    transactions_convert_preview_kind_step: 'Step',
    transactions_convert_preview_description: 'Description',
    transactions_convert_preview_debit: 'Debit',
    transactions_convert_preview_credit: 'Credit',
    transactions_convert_preview_amount: 'Amount',
    transactions_convert_preview_currency: 'Currency',
    transactions_convert_preview_steps_total:
      'Step total: %{steps} (original: %{original})',
    transactions_convert_preview_rate: 'rate × %{rate} (from %{validFrom})',
    transactions_convert_preview_rate_same: 'rate × %{rate}',
    transactions_convert_preview_member_ratio:
      'member ratio × %{ratio} (%{membership})',
    transactions_related_children: '%{count} linked transaction(s)',
    transactions_related_parent: 'Linked to: %{date} / %{amount}',
    transactions_related_parent_short: 'Linked to another transaction',
    transactions_related_parent_row: 'parent',
    transactions_delete_blocked_expanded:
      'Delete the expanded rows of the group first (one by one or with “Delete expanded rows”).',
    transactions_delete_blocked_storno: 'Delete the storno row first.',
    transactions_related_current: 'this row',
    transactions_none: 'No transactions.',
    transactions_page_total: 'Total (rows on this page)',
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
    transactions_bulk_convert_title:
      'Expand %{smart_count} deal |||| Expand %{smart_count} deals',
    transactions_bulk_convert_body:
      'Selected transactions will be expanded per their workflow template (storno and step rows). Transaction data is not edited before expansion.',
    transactions_bulk_convert_body_partial:
      '%{ready} transaction(s) will be expanded. %{skipped} selection(s) will be skipped (already expanded, no template, or multiple templates match).',
    transactions_bulk_convert_confirm: 'Expand',
    transactions_bulk_convert_done:
      '%{smart_count} deal expanded. |||| %{smart_count} deals expanded.',
    transactions_bulk_convert_skipped_converted:
      '%{smart_count} selected row is already expanded and will be skipped. |||| %{smart_count} selected rows are already expanded and will be skipped.',
    transactions_bulk_convert_skipped_no_match:
      '%{smart_count} selected row has no matching workflow template. |||| %{smart_count} selected rows have no matching workflow template.',
    transactions_bulk_convert_skipped_ambiguous:
      '%{smart_count} selected row matches more than one workflow template. |||| %{smart_count} selected rows match more than one workflow template.',
    transactions_bulk_convert_failed:
      'Failed to expand %{smart_count} deal. |||| Failed to expand %{smart_count} deals.',
    transactions_bulk_convert_none_ready:
      'None of the selected transactions can be expanded.',
    transactions_finalize_hint:
      'This transaction is not finalized yet, which means it will not appear in financial statements. Once you have reviewed and found the data and attached receipts to be correct, finalize the transaction and its receipts.',
    transactions_finalize_no_receipt:
      'This transaction has no attached receipt. After finalizing, a receipt can no longer be uploaded, so finalize only if you are sure that no expected receipt will arrive.',
    transactions_finalize_pending:
      'The attached file is not saved yet. Save the receipt first.',
    transactions_finalize_same_person:
      'Changes were saved and the transaction stayed a draft. The person who entered it cannot finalize it.',
    form_issues_count: '%{errors} error(s), %{warnings} warning(s)',
    transactions_create_issues_title: 'Save',
    transactions_create_issues_hint:
      'The transaction is saved as a draft. Fill in the starred fields; a receipt can wait for now.',
    transactions_create_no_receipt:
      'No receipt attached. Not required to save, but upload it now if you have it — you cannot add one after finalizing.',
    transactions_create_account_suggested:
      '%{field}: still empty. It will be required at review — pick one now if you know it.',
    transactions_discard: 'Delete draft',
    transactions_discard_title: 'Delete draft',
    transactions_discard_body:
      'The transaction and its draft receipts will be permanently deleted. This cannot be undone.',
    transactions_discard_confirm: 'Delete',
    transactions_discard_done: 'Draft transaction deleted.',
    transactions_discard_error: 'Could not delete the draft.',
    transactions_delete_row: 'Delete',
    transactions_delete_row_title: 'Delete expanded row',
    transactions_delete_row_body:
      'The expanded row below and its receipts (with uploaded files) are permanently deleted.',
    transactions_delete_row_done: 'Expanded row deleted.',
    transactions_delete_row_error: 'Could not delete the row.',
    transactions_delete_any_row_title: 'Delete transaction',
    transactions_delete_any_row_body:
      'The transaction below and its receipts (with uploaded files) are permanently deleted. Other rows of the group stay; rows linked to this one lose that link.',
    transactions_delete_any_row_done: 'Transaction deleted.',
    transactions_purge_expansion: 'Delete expanded rows (%{count})',
    transactions_purge_expansion_hint:
      'This group has %{count} expanded row(s); you can delete them all at once. Delete single rows with the bin icon at the row end.',
    transactions_purge_expansion_title: 'Delete expanded rows',
    transactions_purge_expansion_rows_body:
      'The expanded rows below and their receipts (with uploaded files) are permanently deleted. Other rows of the group stay.',
    transactions_purge_expansion_rows_done: 'Expanded rows deleted.',
    transactions_purge_expansion_body:
      'The expanded and storno rows below and their receipts (with uploaded files) are permanently deleted. The original transaction becomes expandable again.',
    transactions_purge_expansion_done:
      'Expansion deleted; the original can be expanded again.',
    transactions_purge_expansion_error: 'Could not delete the expansion.',
    transactions_delete_published_warning:
      'Warning: you are deleting published transactions. Posted rows and receipts are removed irreversibly.',
    transactions_leave_title: 'This transaction is still a draft',
    transactions_leave_body: 'Finalizing is still pending. Leave this page?',
    transactions_leave_unsaved_title: 'This transaction is not saved yet',
    transactions_leave_unsaved_body:
      'The data you entered will be lost. Leave this page?',
    transactions_leave_go: 'Leave',
    transactions_leave_stay: 'Stay',
    accounts_seed_missing:
      'The account list is empty because the seed is missing.',
    account_profile: 'Account profile',
    account_profile_all: 'All accounts',
    account_profile_cost: 'Expense',
    account_profile_revenue: 'Revenue',
    account_profile_group_profiles: 'Profiles',
    account_profile_group_workflows: 'Transaction templates',
    account_profile_workflows_loading: 'Loading templates…',
    account_profile_workflow_prefill_incomplete:
      'Template account codes could not be resolved uniquely — check the account fields.',
    account_profile_workflow_dropped:
      'The selected transaction template no longer matches the chosen accounts.',
    reports: {
      range: {
        all: 'All time',
        thisMonth: 'This month',
        lastMonth: 'Last month',
        last7: 'Last 7 days',
        thisYear: 'This year',
      },
      transaction_status: {
        label: 'Transactions',
        /** Published/live books view — default, same as before. */
        preview: 'Published (live books)',
        draft: 'Draft',
        all: 'All (draft + published)',
      },
    },
    egg_inventory: {
      menu: 'Egg inventory',
      title: 'Egg inventory report',
      subtitle:
        'How many eggs were produced, distributed (internal / sale), and left in stock for the selected period.',
      range: {
        all: 'All time',
        thisMonth: 'This month',
        lastMonth: 'Last month',
        last7: 'Last 7 days',
        thisYear: 'This year',
      },
      kpi: {
        produced: 'Produced',
        distributed: 'Distributed',
        remaining: 'Remaining',
        internal: 'Internal',
        sale: 'Sale',
      },
      timeseries_title: 'Quantity over time (by flock)',
      trend_total: 'Total (trend)',
      alom_title: 'Breakdown by flock',
      alom_name: 'Flock',
      members_title: 'Member balances',
      members_subtitle:
        'Grouped bars per member on the same timeline as production; pies show each member’s internal/sale share for the full period.',
      pie_internal: 'Internal share by member',
      pie_sale: 'Sale share by member',
      pie_empty: 'No data for this pie chart.',
      member_name: 'Member',
      member_account: 'Account',
      sale_qty: 'Sale (qty)',
      sale_revenue: 'Sale revenue',
      member_total: 'Total (qty)',
      empty: 'No egg traffic for this period. Try another date range.',
      error: 'Could not load the report.',
      retry: 'Retry',
    },
    hen_inventory: {
      menu: 'Hen registry',
      title: 'Laying-hen inventory report',
      subtitle:
        'HEN stock per flock over time, with slaughter and live-bird transfers to members by day.',
      kpi: {
        stock: 'Stock (end of range)',
        intake: 'Intake',
        slaughter: 'Slaughter',
        transfer: 'Hen transfer',
        mortality: 'Mortality',
      },
      stock_timeseries_title: 'Stock over time (by flock)',
      alom_title: 'Breakdown by flock',
      alom_name: 'Flock',
      slaughter_chart_title: 'Slaughter by day and member',
      members_title: 'Member totals (slaughter / transfer)',
      member_name: 'Member',
      member_account: 'Account',
      member_total: 'Total (head)',
      totals_row: 'Total',
      slaughter_empty:
        'No member hen outflows in this period. The report counts every HEN 1300→member-pocket booking, including the slaughter template.',
      outflow_empty: 'No slaughter or transfers in this period.',
      empty: 'No hen traffic for this period. Try another date range.',
      error: 'Could not load the report.',
      retry: 'Retry',
    },
    membership_ledger: {
      menu: 'Membership ledger',
      title: 'Membership ledger',
      subtitle:
        'Per membership: member payments, deductions, and balances on 1101 share and 1001 pocket ledgers. Date range and currency come from the sidebar filters; currency defaults to HUF when unset. FX amounts are never summed.',
      active_currency: 'Active currency: %{currency}',
      member: 'Member',
      col: {
        payment: '%{code} payment',
        deduction: '%{code} deduction',
        balance: '%{code} balance',
      },
      empty: 'No memberships to show (or memberships have no linked members).',
      empty_activity:
        'No member-ledger activity in the selected period for %{currency}. Try Date range → All, or switch currency (e.g. EGG, KOR).',
      drilldown: {
        hint: 'Click to open the related transactions list',
      },
      error: 'Could not load the report.',
      retry: 'Retry',
    },
    membership_share: {
      menu: 'Share capital report',
      title: 'Member share and pocket',
      subtitle:
        'How much members paid into 1101 share-capital and 1001 pocket ledgers in the selected period, by currency and by member.',
      range: {
        all: 'All time',
        thisMonth: 'This month',
        lastMonth: 'Last month',
        last7: 'Last 7 days',
        thisYear: 'This year',
      },
      focus: {
        both: 'Both',
        share: '1101 share',
        pocket: '1001 pocket',
      },
      ledger: {
        share: '1101 share',
        pocket: '1001 pocket',
      },
      kpi: {
        share: '%{code} share · %{currency}',
        pocket: '%{code} pocket · %{currency}',
        members: 'Members involved',
        payments: 'Payment count',
      },
      bar_title: 'Amount by member (%{currency})',
      pie_title_ledgers: '1101 / 1001 mix (%{currency})',
      pie_title_currencies: 'Breakdown by currency',
      members_title: 'By member',
      members_subtitle:
        'Share (1101) and pocket (1001) payments per member, per currency — currencies are never summed.',
      member_name: 'Member',
      col: {
        share: '%{code} · %{currency}',
        pocket: '%{code} · %{currency}',
      },
      history_title: 'Payments over time (%{currency})',
      history_subtitle:
        'When each member made a capital payment — grouped bars per period, one colour per member.',
      empty: 'No member payments for this period. Try another range or ledger.',
      error: 'Could not load the report.',
      retry: 'Retry',
      drilldown: {
        hint: 'Click: filtered transaction list',
      },
    },
    project_balance: {
      menu: 'Project balances',
      title: 'Project balances',
      subtitle:
        'Per project: production (inflow / revenue-style lines) and investment (5xx/15xx). Default: published only — include drafts via the Transactions filter.',
      project_filter: 'Project (all)',
      currency: 'Currency',
      revenue: 'Production',
      cost: 'Investment',
      kpi: {
        cumulative: 'Cumulative balance · %{currency}',
        period_revenue: 'Period production · %{currency}',
        period_cost: 'Period investment · %{currency}',
        period_net: 'Period net · %{currency}',
      },
      by_project_title: 'Production and investment by project (%{currency})',
      history_title: 'Production and investment over time (%{currency})',
      history_empty: 'No time series for this currency.',
      table_title: 'Project table',
      col: {
        project: 'Project',
        period_revenue: 'Production (%{currency})',
        period_cost: 'Investment (%{currency})',
        period_net: 'Profit (%{currency})',
        cumulative: 'Total (%{currency})',
      },
      empty:
        'No project activity in this range. Try another period or publication filter.',
      error: 'Could not load the report.',
      retry: 'Retry',
      warn_truncated:
        'Transaction load hit the safety cap — older rows may be missing. Narrow the date range or add a backend aggregate later.',
      warn_unclassified:
        '%{count} booked rows have a project but no production/investment pattern (e.g. 1900↔1100 transfers only). Convert templates or fix account pairs may help.',
      drilldown: {
        hint: 'Click: filtered transaction list',
      },
    },
    reconciliation: {
      menu: 'Reconciliation report',
      title: 'Reconciliation report',
      subtitle: 'Read-only domain and user-hygiene checks. Does not fix data.',
      refresh: 'Refresh',
      generated_at: 'Generated: %{value}',
      count: '%{count} issue(s)',
      capped: 'Showing first %{cap} rows',
      empty_section: 'No issues in this section.',
      open_list: 'Transaction list',
      audit_retention_caveat:
        'Inactivity is derived from successful login audit rows (%{days}-day retention). Older logins are invisible — not the same as a dedicated last-login field.',
      sections: {
        draftTransactions: 'Unapproved (draft) transactions',
        orphanReceipts: 'Orphan receipts (no transaction)',
        publishedWithoutReceipts:
          'Published transactions without receipts (finalize warning rule)',
        membersWithoutMembership: 'Members without membership',
        membershipsWithoutMembers: 'Memberships without members',
        membersMissingLedgerAccounts: 'Members missing 1101/1001 accounts',
        orphanMemberAccounts: 'Orphan 1101/1001 accounts',
        usersInvalidRole: 'Disallowed or missing user role',
        usersInactive: 'Inactive users (no successful login in the window)',
      },
      columns: {
        documentId: 'Document',
        date: 'Date',
        amount: 'Amount',
        description: 'Description',
        enteredBy: 'Entered by',
        publishedBy: 'Published by',
        vendor: 'Vendor',
        identifier: 'Identifier',
        name: 'Name',
        email: 'Email',
        organization: 'Organization',
        missingAccount: 'Missing field',
        expectedCode: 'Expected code',
        code: 'Code',
        id: 'ID',
        username: 'Username',
        roleType: 'Role type',
        roleName: 'Role name',
        blocked: 'Blocked',
      },
    },
    profile: 'Profile',
    profile_name: 'Name',
    profile_email: 'Email',
    profile_role: 'Role',
    roles: {
      controller: 'Controller',
      editor: 'Editor',
      dataentry: 'Data entry',
      authenticated: 'Authenticated user',
    },
    sidebar: {
      close: 'Hide menu',
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
      'project-balance': 'Project balance report',
      'egg-production': 'Daily egg entry',
      'member-fee': 'Member fee',
      'membership-share': 'Share capital report',
      'membership-ledger': 'Membership ledger',
    },
    bulk_quantity: {
      save: 'Save',
      catalog_missing:
        'Required master data is missing (hen house, account, currency, or transaction type).',
      no_hen_houses: 'No hen houses found under the parent organization.',
      no_rows: 'Enter at least one non-zero quantity.',
      invalid_quantity: 'Whole number, 0 or greater.',
      results_heading: 'Save results',
      auto_publish_done: 'Saved and published.',
      auto_publish_done_after_update: 'Updated and published.',
      auto_publish_failed: 'Publishing failed.',
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
        'Distribution exceeds today’s production by %{count}. Overspending is allowed ( which will be deducted from earlier stock).',
      distribution_rate: 'Rate (%{from} → %{to}): %{rate}, valid since %{date}',
      distribution_rate_missing:
        'No %{from} → %{to} rate for the selected day; sale rows cannot be saved.',
      distribution_no_members:
        'No members in organization “%{org}” for this date.',
      distribution_members_failed: 'Could not load the member list.',
      pool_transfer: {
        coop: 'Egg stock transfer (coop) — %{organization} → Tyúktartás (%{amount})',
        parent: 'Egg stock transfer (Tyúktartás) — %{organization} (%{amount})',
      },
      description: {
        egg: 'Daily eggs — %{organization}: %{amount}',
        egg_distribution_internal:
          'Egg distribution (internal) — %{member}: %{amount}',
        egg_distribution_sale_egg: 'Egg sale (eggs) — %{member}: %{amount}',
        egg_distribution_cash:
          'Egg sale (cash payment) — %{member}: %{amount} → %{revenue}',
        egg_distribution_revenue:
          'Egg sale (revenue) — %{member}: %{amount} → %{revenue}',
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
    administration: {
      menu: 'Administration',
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
      panel_title: 'Filters',
      date_range: 'Period',
      add: 'Add filter',
      remove: 'Remove',
      custom_date: 'Custom',
      report_drilldown: 'Report drill-down filters',
    },
    converted: {
      none: 'None (expandable)',
      expanded: 'Expanded line',
      storno: 'Storno',
      original: 'Original (source)',
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
        entryId: 'ID',
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
        transaction_type: 'Transaction type',
        vendor: 'Vendor',
        status: 'Status',
        converted_to_workflow: 'Deal expansion',
        receipt: 'Receipt',
        related_group: 'Linked transactions',
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
