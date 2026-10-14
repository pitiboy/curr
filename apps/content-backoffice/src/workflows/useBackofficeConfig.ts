import { useContext } from 'react';

import { BackofficeConfigContext } from './backofficeConfigContext';

export function useBackofficeConfig() {
  const value = useContext(BackofficeConfigContext);
  if (!value) {
    throw new Error('useBackofficeConfig requires BackofficeConfigProvider');
  }
  return value;
}
