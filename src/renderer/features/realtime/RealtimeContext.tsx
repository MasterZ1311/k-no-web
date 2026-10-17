import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  RealtimeStatus,
  RealtimeTable,
  RealtimeInvalidationEvent,
  PresenceUser,
  NoteComment,
} from '../../../preload/types';
import { useRoom } from '../rooms/RoomContext';
import { useAuth } from '../auth/AuthContext';

// Distinct curated color hues for collaborators
const COLLABORATOR_COLORS = [
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#14b8a6', // Teal
  '#f43f5e', // Rose
];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COLLABORATOR_COLORS.length;
  return COLLABORATOR_COLORS[index];
}

interface RealtimeContextValue {
  status: RealtimeStatus;
  presenceUsers: PresenceUser[];
  subscribeInvalidation: (callback: (event: RealtimeInvalidationEvent) => void) => () => void;
  trackPresence: (state: Partial<PresenceUser>) => void;
  broadcastComment: (comment: NoteComment) => Promise<void>;
  subscribeComment: (callback: (comment: NoteComment) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRoom, refreshRooms } = useRoom();
  const { user } = useAuth();
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const listenersRef = useRef<Set<(event: RealtimeInvalidationEvent) => void>>(new Set());
  const commentListenersRef = useRef<Set<(comment: NoteComment) => void>>(new Set());

  // Subscribe to room realtime channel when activeRoom changes
  useEffect(() => {
    if (!user || !activeRoom?.id || !window.kanoDesktop?.realtime) {
      if (window.kanoDesktop?.realtime) {
        window.kanoDesktop.realtime.unsubscribeRoom().catch(() => {});
      }
      setStatus('disconnected');
      setPresenceUsers([]);
      return;
    }

    let isMounted = true;

    window.kanoDesktop.realtime
      .subscribeRoom(activeRoom.id)
      .then((res) => {
        if (isMounted && res.success) {
          window.kanoDesktop.realtime.getStatus().then((s) => {
            if (isMounted) setStatus(s);
          });
          // Track current user presence
          window.kanoDesktop.realtime.trackPresence?.({
            userId: user.id,
            name: user.displayName || user.email?.split('@')[0] || 'You',
            email: user.email || '',
            color: getUserColor(user.id),
            onlineAt: new Date().toISOString(),
          }).catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('[RealtimeProvider] Subscribe room error:', err);
      });

    const unsubscribeStatus = window.kanoDesktop.realtime.onStatusChange((newStatus) => {
      if (isMounted) {
        setStatus(newStatus);
        if (newStatus === 'connected') {
          for (const listener of listenersRef.current) {
            listener({
              roomId: activeRoom.id,
              table: 'notes',
              eventType: 'UPDATE',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    });

    const unsubscribeInvalidation = window.kanoDesktop.realtime.onInvalidation((event) => {
      if (!isMounted) return;

      if (
        (event.table === 'room_members' && event.eventType === 'DELETE') ||
        (event.table === 'activity_logs' && event.eventType === 'INSERT')
      ) {
        refreshRooms().catch(() => {});
      }

      for (const listener of listenersRef.current) {
        try {
          listener(event);
        } catch (err) {
          console.warn('[RealtimeProvider] Invalidation listener error:', err);
        }
      }
    });

    const unsubscribePresence = window.kanoDesktop.realtime.onPresenceChange?.((users) => {
      if (isMounted) {
        setPresenceUsers(users);
      }
    });

    const unsubscribeComment = window.kanoDesktop.realtime.onCommentBroadcast?.((comment) => {
      if (isMounted) {
        for (const listener of commentListenersRef.current) {
          try {
            listener(comment);
          } catch (err) {
            console.warn('[RealtimeProvider] Comment listener error:', err);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeStatus();
      unsubscribeInvalidation();
      if (unsubscribePresence) unsubscribePresence();
      if (unsubscribeComment) unsubscribeComment();
      if (window.kanoDesktop?.realtime) {
        window.kanoDesktop.realtime.unsubscribeRoom().catch(() => {});
      }
    };
  }, [activeRoom?.id, user, refreshRooms]);

  const subscribeInvalidation = useCallback((callback: (event: RealtimeInvalidationEvent) => void) => {
    listenersRef.current.add(callback);
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  const trackPresence = useCallback(
    (state: Partial<PresenceUser>) => {
      if (!window.kanoDesktop?.realtime?.trackPresence) return;
      window.kanoDesktop.realtime.trackPresence(state).catch(() => {});
    },
    []
  );

  const broadcastComment = useCallback(
    async (comment: NoteComment) => {
      if (!window.kanoDesktop?.realtime?.broadcastComment) return;
      await window.kanoDesktop.realtime.broadcastComment(comment);
    },
    []
  );

  const subscribeComment = useCallback((callback: (comment: NoteComment) => void) => {
    commentListenersRef.current.add(callback);
    return () => {
      commentListenersRef.current.delete(callback);
    };
  }, []);

  const value: RealtimeContextValue = {
    status,
    presenceUsers,
    subscribeInvalidation,
    trackPresence,
    broadcastComment,
    subscribeComment,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

const defaultRealtimeContext: RealtimeContextValue = {
  status: 'disconnected',
  presenceUsers: [],
  subscribeInvalidation: () => () => {},
  trackPresence: () => {},
  broadcastComment: async () => {},
  subscribeComment: () => () => {},
};

export const useRealtime = (): RealtimeContextValue => {
  const context = useContext(RealtimeContext);
  return context || defaultRealtimeContext;
};


/**
 * Hook to automatically react to realtime table invalidations with debouncing.
 */
export function useRealtimeInvalidation(
  tables: RealtimeTable[],
  onInvalidate: (events: RealtimeInvalidationEvent[]) => void,
  debounceMs = 300
): void {
  const { subscribeInvalidation } = useRealtime();
  const queueRef = useRef<RealtimeInvalidationEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onInvalidateRef = useRef(onInvalidate);
  onInvalidateRef.current = onInvalidate;

  useEffect(() => {
    const tableSet = new Set(tables);

    const unsubscribe = subscribeInvalidation((event) => {
      if (tableSet.has(event.table)) {
        queueRef.current.push(event);

        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
          const events = [...queueRef.current];
          queueRef.current = [];
          onInvalidateRef.current(events);
        }, debounceMs);
      }
    });

    return () => {
      unsubscribe();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [tables, subscribeInvalidation, debounceMs]);
}
