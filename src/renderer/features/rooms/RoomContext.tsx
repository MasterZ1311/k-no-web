import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { RoomDTO } from '../../../preload/types';
import { useAuth } from '../auth/AuthContext';

interface RoomContextValue {
  rooms: RoomDTO[];
  activeRoom: RoomDTO | null;
  isLoading: boolean;
  setActiveRoom: (room: RoomDTO) => void;
  refreshRooms: () => Promise<void>;
  createRoom: (name: string, description?: string) => Promise<{ success: boolean; room?: RoomDTO; error?: string }>;
  redeemInvitation: (
    token: string
  ) => Promise<{ success: boolean; roomId?: string; alreadyMember?: boolean; error?: string }>;
}

const RoomContext = createContext<RoomContextValue | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [activeRoom, setActiveRoom] = useState<RoomDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshRooms = useCallback(async () => {
    if (!user || !window.kanoDesktop?.rooms) {
      setRooms([]);
      setActiveRoom(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await window.kanoDesktop.rooms.getRooms();
      if (response.success && response.rooms) {
        setRooms(response.rooms);
        // Maintain active room if still in list, else default to first room
        setActiveRoom((prev: RoomDTO | null) => {
          if (prev && response.rooms.some((r) => r.id === prev.id)) {
            return response.rooms.find((r) => r.id === prev.id) || null;
          }
          return response.rooms.length > 0 ? response.rooms[0] : null;
        });
      }
    } catch (err) {
      console.error('[RoomContext] Failed to load rooms:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshRooms();
  }, [refreshRooms]);

  const createRoom = async (name: string, description?: string) => {
    if (!window.kanoDesktop?.rooms) {
      return { success: false, error: 'Desktop bridge unavailable.' };
    }

    const result = await window.kanoDesktop.rooms.createRoom(name, description);
    if (result.success && result.room) {
      await refreshRooms();
      setActiveRoom(result.room);
    }
    return result;
  };

  const redeemInvitation = async (token: string) => {
    if (!window.kanoDesktop?.rooms) {
      return { success: false, error: 'Desktop bridge unavailable.' };
    }

    const result = await window.kanoDesktop.rooms.redeemInvitation(token);
    if (result.success) {
      await refreshRooms();
    }
    return result;
  };

  const value: RoomContextValue = {
    rooms,
    activeRoom,
    isLoading,
    setActiveRoom,
    refreshRooms,
    createRoom,
    redeemInvitation,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};

export const useRooms = (): RoomContextValue => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRooms must be used within a RoomProvider');
  }
  return context;
};

export const useRoom = useRooms;
