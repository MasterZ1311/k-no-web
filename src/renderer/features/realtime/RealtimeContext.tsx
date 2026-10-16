import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  RealtimeStatus,
  RealtimeTable,
  RealtimeInvalidationEvent,
} from '../../../preload/types';
import { useRoom } from '../rooms/RoomContext';
import { useAuth } from '../auth/AuthContext';

interface RealtimeContextValue {
  status: RealtimeStatus;
  subscribeInvalidation: (callback: (event: RealtimeInvalidationEvent) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRoom, refreshRooms } = useRoom();
  const { user } = useAuth();
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');
  const listenersRef = useRef<Set<(event: RealtimeInvalidationEvent) => void>>(new Set());

  // Subscribe to room realtime channel when activeRoom changes
  useEffect(() => {
    if (!user || !activeRoom?.id || !window.kanoDesktop?.realtime) {
      if (window.kanoDesktop?.realtime) {
        window.kanoDesktop.realtime.unsubscribeRoom().catch(() => {});
      }
      setStatus('disconnected');
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
        }
      })
      .catch((err) => {
        console.warn('[RealtimeProvider] Subscribe room error:', err);
      });

    const unsubscribeStatus = window.kanoDesktop.realtime.onStatusChange((newStatus) => {
      if (isMounted) {
        setStatus(newStatus);
        // If reconnected, trigger a gentle refresh of room data
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

      // Handle room membership eviction or room deletion
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

    return () => {
      isMounted = false;
      unsubscribeStatus();
      unsubscribeInvalidation();
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

  const value: RealtimeContextValue = {
    status,
    subscribeInvalidation,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

const defaultRealtimeContext: RealtimeContextValue = {
  status: 'disconnected',
  subscribeInvalidation: () => () => {},
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
