import type { Schema, Struct } from '@strapi/strapi';

export interface WorkflowStep extends Struct.ComponentSchema {
  collectionName: 'components_workflow_steps';
  info: {
    displayName: 'Step';
    icon: 'bulletList';
  };
  attributes: {
    copy_receipt: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    credit_account: Schema.Attribute.Relation<
      'oneToOne',
      'api::account.account'
    >;
    credit_account_code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 10;
      }>;
    currency_type: Schema.Attribute.Relation<
      'oneToOne',
      'api::currency-type.currency-type'
    > &
      Schema.Attribute.Required;
    debit_account: Schema.Attribute.Relation<
      'oneToOne',
      'api::account.account'
    >;
    debit_account_code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 10;
      }>;
    description: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'{1}'>;
    organization: Schema.Attribute.Relation<
      'oneToOne',
      'api::organization.organization'
    > &
      Schema.Attribute.Required;
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
    }
  }
}
