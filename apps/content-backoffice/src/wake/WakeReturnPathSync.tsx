import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { persistWakeReturnPath } from './wakeReturnPath';

/** Keeps `kor-wake-next` fresh while the SPA navigates (early bootstrap runs from index.html). */
export function WakeReturnPathSync() {
  const location = useLocation();

  useEffect(() => {
    persistWakeReturnPath(location.pathname, location.search, location.hash);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
