import type { Schema, Struct } from '@strapi/strapi';

export interface WorkflowStep extends Struct.ComponentSchema {
  collectionName: 'components_workflow_steps';
  info: {
    displayName: 'Step with Related accounts';
    icon: 'bulletList';
  };
  attributes: {
    copy_receipt: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    credit_account: Schema.Attribute.Relation<
      'oneToOne',
      'api::account.account'
    > &
      Schema.Attribute.Required;
    currency_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::currency-type.currency-type'
    > &
      Schema.Attribute.Required;
    debit_account: Schema.Attribute.Relation<
      'oneToOne',
      'api::account.account'
    > &
      Schema.Attribute.Required;
    description: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'{1}'>;
    organization: Schema.Attribute.Relation<
      'oneToOne',
      'api::organization.organization'
    >;
    organization_from_original: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    percent: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<100>;
    transaction_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::transaction-type.transaction-type'
    >;
  };
}

export interface WorkflowStepMemberCredit extends Struct.ComponentSchema {
  collectionName: 'components_workflow_step_member_credits';
  info: {
    displayName: 'Step with Member as Credit';
    icon: 'user';
  };
  attributes: {
    copy_receipt: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    currency_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::currency-type.currency-type'
    > &
      Schema.Attribute.Required;
    debit_account: Schema.Attribute.Relation<
      'oneToOne',
      'api::account.account'
    > &
      Schema.Attribute.Required;
    description: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'{1}'>;
    member_account_code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 10;
      }>;
    organization: Schema.Attribute.Relation<
      'oneToOne',
      'api::organization.organization'
    >;
    organization_from_original: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    percent: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<100>;
    transaction_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::transaction-type.transaction-type'
    >;
  };
}

export interface WorkflowStepMemberDebit extends Struct.ComponentSchema {
  collectionName: 'components_workflow_step_member_debits';
  info: {
    displayName: 'Step with Member as Debit';
    icon: 'user';
  };
  attributes: {
    copy_receipt: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    credit_account: Schema.Attribute.Relation<
      'oneToOne',
      'api::account.account'
    > &
      Schema.Attribute.Required;
    currency_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::currency-type.currency-type'
    > &
      Schema.Attribute.Required;
    description: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'{1}'>;
    member_account_code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 10;
      }>;
    organization: Schema.Attribute.Relation<
      'oneToOne',
      'api::organization.organization'
    >;
    organization_from_original: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    percent: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<100>;
    transaction_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::transaction-type.transaction-type'
    >;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'workflow.step': WorkflowStep;
      'workflow.step-member-credit': WorkflowStepMemberCredit;
      'workflow.step-member-debit': WorkflowStepMemberDebit;
    }
  }
}
