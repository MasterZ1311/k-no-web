import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  FileText,
  Folder,
  CheckSquare,
  Layout,
  Calendar,
  Users,
  AlertCircle,
  FileQuestion,
} from 'lucide-react';
import type { ActivityLogDTO } from '../../preload/types';
import { useRoom } from '../features/rooms/RoomContext';
import { useRealtime } from '../features/realtime/RealtimeContext';
import { LoadingState } from '../design-system/LoadingState';
import { EmptyState } from '../design-system/EmptyState';
import { Button } from '../design-system/Button';

type EntityFilter = 'all' | 'note' | 'folder' | 'task' | 'board' | 'calendar_event' | 'member';

export const ActivityRoute: React.FC = () => {
  const { activeRoom } = useRoom();
  const { subscribeInvalidation } = useRealtime();

  const [logs, setLogs] = useState<ActivityLogDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EntityFilter>('all');

  const fetchLogs = useCallback(async () => {
    if (!activeRoom?.id || !window.kanoDesktop?.activity) {
      setLogs([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await window.kanoDesktop.activity.getLogs(activeRoom.id, 100, 0);
      if (response.success && response.logs) {
        setLogs(response.logs);
      } else {
        setError(response.error || 'Failed to load room activity logs.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while fetching activity.');
    } finally {
      setIsLoading(false);
    }
  }, [activeRoom?.id]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Realtime live refresh on activity_logs invalidations
  useEffect(() => {
    const unsubscribe = subscribeInvalidation((event) => {
      if (event.roomId === activeRoom?.id && (event.table === 'activity_logs' || event.table === 'notes' || event.table === 'tasks')) {
        fetchLogs();
      }
    });
    return unsubscribe;
  }, [activeRoom?.id, fetchLogs, subscribeInvalidation]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.entityType === filter;
  });

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'note':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'folder':
        return <Folder className="w-4 h-4 text-blue-500" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-amber-500" />;
      case 'board':
        return <Layout className="w-4 h-4 text-indigo-500" />;
      case 'calendar_event':
        return <Calendar className="w-4 h-4 text-rose-500" />;
      case 'member':
        return <Users className="w-4 h-4 text-purple-500" />;
      default:
        return <Activity className="w-4 h-4 text-kano-text-muted" />;
    }
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'created':
      case 'joined':
      case 'restored':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'updated':
      case 'moved':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'deleted':
      case 'removed':
      case 'left':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'exported':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      default:
        return 'bg-kano-surface border-kano-border text-kano-text-secondary';
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const getEntityName = (log: ActivityLogDTO) => {
    if (log.details) {
      if (typeof log.details.title === 'string' && log.details.title) {
        return log.details.title;
      }
      if (typeof log.details.name === 'string' && log.details.name) {
        return log.details.name;
      }
      if (typeof log.details.filename === 'string' && log.details.filename) {
        return log.details.filename;
      }
    }
    return `${log.entityType} (${log.entityId.slice(0, 8)})`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 select-none max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-kano-text-primary flex items-center gap-2">
            <Activity className="w-5 h-5 text-kano-accent" />
            Room Activity Stream
          </h1>
          <p className="text-xs text-kano-text-muted mt-1">
            Immutable audit record of membership, document mutations, and room operations.
          </p>
        </div>
        {activeRoom && (
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>

      {!activeRoom ? (
        <div className="bg-kano-surface border border-kano-border rounded-xl p-8 sm:p-12 text-center">
          <EmptyState
            icon={<Activity className="w-6 h-6" />}
            title="No Active Room"
            description="Select or create a workspace room to view activity history."
          />
        </div>
      ) : (
        <>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(
          [
            { id: 'all', label: 'All Activity' },
            { id: 'note', label: 'Notes' },
            { id: 'folder', label: 'Folders' },
            { id: 'task', label: 'Tasks' },
            { id: 'board', label: 'Boards' },
            { id: 'calendar_event', label: 'Calendar' },
            { id: 'member', label: 'Members' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              filter === item.id
                ? 'bg-kano-accent text-white border-kano-accent shadow-sm'
                : 'bg-kano-surface text-kano-text-secondary border-kano-border hover:bg-kano-surface-hover'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchLogs}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && logs.length === 0 ? (
        <div className="py-16">
          <LoadingState label="Loading activity stream..." />
        </div>
      ) : filteredLogs.length === 0 ? (
        /* Empty State */
        <div className="bg-kano-surface border border-kano-border rounded-xl p-12 text-center">
          <EmptyState
            icon={<FileQuestion className="w-6 h-6" />}
            title={filter === 'all' ? 'No Activity Recorded Yet' : `No ${filter} Activity`}
            description={
              filter === 'all'
                ? 'Mutations, edits, and member changes in this room will appear here in chronological order.'
                : `There are no recorded activity events matching the "${filter}" filter in this room.`
            }
          />
        </div>
      ) : (
        /* Activity List */
        <div className="bg-kano-surface border border-kano-border rounded-xl shadow-subtle divide-y divide-kano-border overflow-hidden">
          {filteredLogs.map((log) => {
            const actorDisplay = log.actorName || log.actorEmail || 'System / Member';
            const entityName = getEntityName(log);
            const folderName =
              log.details && typeof log.details.folderName === 'string'
                ? log.details.folderName
                : null;

            return (
              <div
                key={log.id}
                className="p-4 flex items-center justify-between hover:bg-kano-surface-hover/50 transition-colors text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-kano-surface-hover border border-kano-border flex items-center justify-center flex-shrink-0">
                    {getEntityIcon(log.entityType)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-kano-text-primary truncate">
                      <span className="font-semibold text-kano-text-primary">{actorDisplay}</span>{' '}
                      <span className="text-kano-text-muted">{log.action}</span>{' '}
                      <span className="font-semibold text-kano-accent">"{entityName}"</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-kano-text-muted">
                      <span>{formatTimestamp(log.createdAt)}</span>
                      <span>•</span>
                      <span className="capitalize">{log.entityType.replace('_', ' ')}</span>
                      {folderName && (
                        <>
                          <span>•</span>
                          <span>in {folderName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider ${getActionBadgeClass(
                      log.action
                    )}`}
                  >
                    {log.action}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}
    </div>
  );
};
