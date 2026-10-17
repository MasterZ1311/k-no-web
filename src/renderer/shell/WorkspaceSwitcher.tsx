import React, { useState } from 'react';
import { ChevronsUpDown, Check, Plus, FolderKanban, Users, LogIn } from 'lucide-react';
import { DropdownMenu } from '../design-system/DropdownMenu';
import { useToast } from '../design-system/ToastProvider';
import { useRooms } from '../features/rooms/RoomContext';
import { CreateRoomDialog } from '../features/rooms/CreateRoomDialog';
import { JoinRoomDialog } from '../features/rooms/JoinRoomDialog';
import { ManageMembersDialog } from '../features/rooms/ManageMembersDialog';
import type { RoomDTO } from '../../preload/types';

interface WorkspaceSwitcherProps {
  isCollapsed: boolean;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ isCollapsed }) => {
  const { rooms, activeRoom, setActiveRoom } = useRooms();
  const { showToast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);

  const handleSelectRoom = (room: RoomDTO) => {
    setActiveRoom(room);
    showToast(`Switched to ${room.name}`, {
      type: 'info',
      description: `Active room role: ${room.role}.`,
    });
  };

  const displayName = activeRoom?.name || (rooms.length > 0 ? rooms[0].name : 'Personal Workspace');
  const displayRole = activeRoom ? (activeRoom.role === 'owner' ? 'Owner' : 'Member') : 'Owner';

  const trigger = (
    <button
      type="button"
      aria-label="Switch workspace"
      className={`w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-kano-surface-hover text-left transition-colors border border-transparent hover:border-kano-border select-none ${
        isCollapsed ? 'justify-center p-1' : ''
      }`}
    >
      <div className="w-7 h-7 rounded-lg bg-kano-accent text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-subtle">
        <FolderKanban className="w-4 h-4" />
      </div>
      {!isCollapsed && (
        <>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-kano-text-primary truncate">
                {displayName}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                displayRole === 'Owner'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}>
                {displayRole}
              </span>
            </div>
            <span className="text-xs text-kano-text-muted block truncate">
              {activeRoom?.description || 'Private workspace'}
            </span>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-kano-text-muted flex-shrink-0" />
        </>
      )}
    </button>
  );

  const roomMenuItems = rooms.map((room) => ({
    id: room.id,
    label: room.name,
    badge: room.role === 'owner' ? 'Owner' : 'Member',
    icon: (activeRoom?.id === room.id || (!activeRoom && room.name === displayName))
      ? <Check className="w-3.5 h-3.5 text-kano-accent" />
      : <div className="w-3.5" />,
    onClick: () => handleSelectRoom(room),
  }));

  const menuItems = [
    ...(roomMenuItems.length > 0 ? roomMenuItems : [{
      id: 'default-ws',
      label: 'Personal Workspace',
      badge: 'Owner',
      icon: <Check className="w-3.5 h-3.5 text-kano-accent" />,
      onClick: () => {},
    }]),
    'separator' as const,
    {
      id: 'create-room',
      label: 'Create Private Room...',
      icon: <Plus className="w-3.5 h-3.5" />,
      onClick: () => setIsCreateOpen(true),
    },
    {
      id: 'join-room',
      label: 'Join with Invitation Token...',
      icon: <LogIn className="w-3.5 h-3.5" />,
      onClick: () => setIsJoinOpen(true),
    },
    ...(activeRoom ? [
      'separator' as const,
      {
        id: 'manage-members',
        label: activeRoom.role === 'owner' ? 'Manage Members & Invitations...' : 'View Room Members...',
        icon: <Users className="w-3.5 h-3.5" />,
        onClick: () => setIsManageOpen(true),
      },
    ] : []),
  ];

  return (
    <>
      <DropdownMenu trigger={trigger} items={menuItems} align="left" className="w-full" />

      <CreateRoomDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <JoinRoomDialog isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />
      <ManageMembersDialog isOpen={isManageOpen} onClose={() => setIsManageOpen(false)} />
    </>
  );
};
