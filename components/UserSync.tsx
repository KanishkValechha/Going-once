'use client';

import { useEffect, useRef } from 'react';
import { useConvexAuth, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

/**
 * Syncs the authenticated WorkOS identity into the Convex `users` table once
 * per session. No-ops for unauthenticated visitors (e.g. the public /live screen).
 */
export function UserSync() {
  const { isAuthenticated } = useConvexAuth();
  const syncUser = useMutation(api.users.syncUser);
  const synced = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !synced.current) {
      synced.current = true;
      void syncUser().catch(() => {
        synced.current = false;
      });
    }
  }, [isAuthenticated, syncUser]);

  return null;
}
