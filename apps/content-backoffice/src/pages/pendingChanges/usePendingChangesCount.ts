import { useCallback, useEffect, useState } from 'react';

import {
  countActivePendingForUser,
  listPendingChangesForCurrentUser,
} from '../../data/pendingChanges/store';
import { subscribePendingChanges } from '../../data/pendingChanges/storeEvents';
import { getPendingChangeUser } from '../../data/pendingChanges/currentUser';

export function usePendingChangesCount(): number {
  const [count, setCount] = useState(0);

  const reload = useCallback(async () => {
    const user = getPendingChangeUser();
    if (!user) {
      setCount(0);
      return;
    }
    setCount(await countActivePendingForUser(user));
  }, []);

  useEffect(() => {
    void reload();
    return subscribePendingChanges(() => {
      void reload();
    });
  }, [reload]);

  return count;
}

export function usePendingChangesList() {
  const [items, setItems] = useState<Awaited<
    ReturnType<typeof listPendingChangesForCurrentUser>
  > | null>(null);

  const reload = useCallback(async () => {
    setItems(await listPendingChangesForCurrentUser());
  }, []);

  useEffect(() => {
    void reload();
    return subscribePendingChanges(() => {
      void reload();
    });
  }, [reload]);

  return { items, reload };
}
