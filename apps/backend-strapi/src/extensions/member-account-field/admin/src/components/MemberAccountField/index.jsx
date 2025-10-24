import React from 'react';
import {
  Field,
  FieldLabel,
  FieldHint,
  FieldError,
} from '@strapi/design-system';
import { useCMEditViewDataManager } from '@strapi/helper-plugin';

const MemberAccountField = ({
  name,
  value,
  onChange,
  error,
  hint,
  label,
  required,
}) => {
  const { initialData } = useCMEditViewDataManager();

  // Get the account name from the initial data
  const accountName = initialData?.account?.name || 'Nincs számla';

  return (
    <Field name={name} error={error} hint={hint} required={required}>
      <FieldLabel>{label}</FieldLabel>
      <div
        style={{
          padding: '12px',
          backgroundColor: '#f6f6f9',
          border: '1px solid #dcdce4',
          borderRadius: '4px',
          color: '#666',
          fontSize: '14px',
        }}
      >
        <strong>{accountName}</strong>
        <div style={{ fontSize: '12px', marginTop: '4px', color: '#999' }}>
          Ez a mező automatikusan kezelt. A tag számlája automatikusan létrejön
          a tag regisztrálásakor.
        </div>
      </div>
      {hint && <FieldHint>{hint}</FieldHint>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
};

export default MemberAccountField;
