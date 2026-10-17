import React, { useState, useRef, useEffect } from 'react';
import { Users, Eye, Sparkles, UserPlus } from 'lucide-react';
import { useRealtime } from './RealtimeContext';
import { useAuth } from '../auth/AuthContext';
import type { PresenceUser } from '../../../preload/types';

interface PresenceAvatarStackProps {
  maxVisible?: number;
  className?: string;
}

export const PresenceAvatarStack: React.FC<PresenceAvatarStackProps> = ({
  maxVisible = 4,
  className = '',
}) => {
  const { presenceUsers, trackPresence } = useRealtime();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Provide realistic fallback/demo collaborators if only current user is online
  const displayedUsers: PresenceUser[] = presenceUsers.length > 0 ? presenceUsers : (
    user ? [
      {
        userId: user.id,
        name: user.displayName || user.email?.split('@')[0] || 'You',
        email: user.email || '',
        color: '#10b981',
        onlineAt: new Date().toISOString(),
      }
    ] : []
  );

  const visibleUsers = displayedUsers.slice(0, maxVisible);
  const hiddenCount = Math.max(0, displayedUsers.length - maxVisible);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name[0] || 'U').toUpperCase();
  };

  const handleSimulateCollaborator = () => {
    const demoNames = ['Sarah Chen', 'Marcus Thorne', 'Elena Rostova', 'Devon Vance'];
    const randomName = demoNames[Math.floor(Math.random() * demoNames.length)];
    const randomId = `demo-${Date.now().toString(36)}`;
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    trackPresence({
      userId: randomId,
      name: randomName,
      email: `${randomName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      color,
      currentRoute: '/notes',
      onlineAt: new Date().toISOString(),
    });
  };

  if (displayedUsers.length === 0) return null;

  return (
    <div ref={containerRef} className={`relative flex items-center ${className}`}>
      {/* Avatars Stack Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Active collaborators in room"
        title="View live room collaborators"
        className="flex items-center -space-x-2 p-1 rounded-full hover:bg-kano-surface-hover/80 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-kano-accent/40"
      >
        {visibleUsers.map((collaborator, index) => {
          return (
            <div
              key={collaborator.userId}
              style={{
                zIndex: visibleUsers.length - index,
                borderColor: collaborator.color || '#10b981',
              }}
              className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 bg-kano-surface flex items-center justify-center shadow-subtle text-[11px] font-bold text-white uppercase select-none transition-transform hover:scale-110 hover:z-20"
            >
              <div
                style={{ backgroundColor: collaborator.color || '#10b981' }}
                className="w-full h-full rounded-full flex items-center justify-center"
              >
                {getInitials(collaborator.name)}
              </div>
              {/* Online pulse dot */}
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-kano-surface" />
            </div>
          );
        })}

        {hiddenCount > 0 && (
          <div
            style={{ zIndex: 0 }}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-kano-border bg-kano-bg text-kano-text-secondary flex items-center justify-center shadow-subtle text-[10px] font-bold"
          >
            +{hiddenCount}
          </div>
        )}
      </button>

      {/* Collaborators Details Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-kano-surface/95 backdrop-blur-xl border border-kano-border rounded-xl shadow-modal z-50 p-3 animate-in fade-in zoom-in-95 duration-100 select-none">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-kano-border/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-kano-text-primary">
              <Users className="w-3.5 h-3.5 text-kano-accent" />
              <span>Room Presence ({displayedUsers.length})</span>
            </div>
            <button
              type="button"
              onClick={handleSimulateCollaborator}
              className="flex items-center gap-1 text-[10px] text-kano-accent hover:underline font-medium"
              title="Add simulated collaborator to preview multiplayer"
            >
              <UserPlus className="w-3 h-3" />
              <span>Simulate Peer</span>
            </button>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {displayedUsers.map((collaborator) => {
              const isCurrentUser = user && collaborator.userId === user.id;
              return (
                <div
                  key={collaborator.userId}
                  className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-kano-bg transition-colors text-xs"
                >
                  <div
                    style={{ backgroundColor: collaborator.color || '#10b981' }}
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[11px] shrink-0 shadow-xs"
                  >
                    {getInitials(collaborator.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-kano-text-primary truncate">
                        {collaborator.name}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-kano-accent/15 text-kano-accent font-semibold">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-kano-text-muted mt-0.5 truncate">
                      <Eye className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                      <span>{collaborator.currentRoute ? `Active in ${collaborator.currentRoute.replace('/', '')}` : 'Active in workspace'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-kano-border/60 text-[10px] text-kano-text-muted flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Supabase Realtime Live
            </span>
            <span className="font-mono text-[9px]">Synced</span>
          </div>
        </div>
      )}
    </div>
  );
};
