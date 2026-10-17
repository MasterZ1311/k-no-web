import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Files,
  Inbox,
} from 'lucide-react';
import { IconButton } from '../../design-system/IconButton';
import { DropdownMenu } from '../../design-system/DropdownMenu';
import type { FolderDTO } from '../../../preload/types';

interface FolderTreeProps {
  folders: FolderDTO[];
  selectedFolderId: string | 'all' | 'uncategorized';
  onSelectFolder: (folderId: string | 'all' | 'uncategorized') => void;
  onCreateFolder: (parentId?: string | null) => void;
  onRenameFolder: (folder: FolderDTO) => void;
  onDeleteFolder: (folderId: string) => void;
  totalNotesCount?: number;
  uncategorizedNotesCount?: number;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  totalNotesCount = 0,
  uncategorizedNotesCount = 0,
}) => {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolderIds((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Group folders by parentId
  const childrenMap: Record<string, FolderDTO[]> = {};
  const rootFolders: FolderDTO[] = [];

  for (const folder of folders) {
    if (!folder.parentId) {
      rootFolders.push(folder);
    } else {
      if (!childrenMap[folder.parentId]) {
        childrenMap[folder.parentId] = [];
      }
      childrenMap[folder.parentId].push(folder);
    }
  }

  const renderFolderItem = (folder: FolderDTO, depth = 0) => {
    const children = childrenMap[folder.id] || [];
    const hasChildren = children.length > 0;
    const isExpanded = !!expandedFolderIds[folder.id];
    const isSelected = selectedFolderId === folder.id;

    return (
      <div key={folder.id} className="select-none">
        <div
          onClick={() => onSelectFolder(folder.id)}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-md cursor-pointer transition-colors text-xs ${
            isSelected
              ? 'bg-kano-surface-hover text-kano-accent font-medium'
              : 'text-kano-text-secondary hover:bg-kano-surface-hover hover:text-kano-text-primary'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(folder.id, e)}
                className="w-5 h-5 flex items-center justify-center p-0.5 text-kano-text-muted hover:text-kano-text-primary rounded transition-colors shrink-0"
                aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}

            {isExpanded || isSelected ? (
              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
            ) : (
              <Folder className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
            )}

            <span className="truncate flex-1">{folder.name}</span>
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
            {typeof folder.noteCount === 'number' && folder.noteCount > 0 && (
              <span className="text-[10px] px-1 py-0.2 rounded bg-kano-bg text-kano-text-muted font-mono">
                {folder.noteCount}
              </span>
            )}

            <DropdownMenu
              trigger={
                <IconButton
                  aria-label="Folder actions"
                  variant="ghost"
                  size="sm"
                  className="w-5 h-5 p-0.5 opacity-0 group-hover:opacity-100 text-kano-text-muted hover:text-kano-text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-3 h-3" />
                </IconButton>
              }
              items={[
                {
                  id: 'new-subfolder',
                  label: 'New Subfolder',
                  icon: <Plus className="w-3.5 h-3.5" />,
                  onClick: () => {
                    setExpandedFolderIds((prev) => ({ ...prev, [folder.id]: true }));
                    onCreateFolder(folder.id);
                  },
                },
                {
                  id: 'rename',
                  label: 'Rename',
                  icon: <Edit2 className="w-3.5 h-3.5" />,
                  onClick: () => onRenameFolder(folder),
                },
                {
                  id: 'delete',
                  label: 'Delete Folder',
                  icon: <Trash2 className="w-3.5 h-3.5" />,
                  danger: true,
                  onClick: () => onDeleteFolder(folder.id),
                },
              ]}
            />
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-0.5 mt-0.5">
            {children.map((child) => renderFolderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full select-none">
      {/* Folder Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-kano-border">
        <span className="text-xs font-semibold text-kano-text-muted uppercase tracking-wider">
          Folders
        </span>
        <IconButton
          aria-label="New folder"
          variant="ghost"
          size="sm"
          className="w-6 h-6 p-1 text-kano-text-muted hover:text-kano-text-primary"
          onClick={() => onCreateFolder(null)}
        >
          <Plus className="w-3.5 h-3.5" />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* All Notes filter */}
        <div
          onClick={() => onSelectFolder('all')}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${
            selectedFolderId === 'all'
              ? 'bg-kano-surface-hover text-kano-accent font-medium'
              : 'text-kano-text-secondary hover:bg-kano-surface-hover hover:text-kano-text-primary'
          }`}
        >
          <div className="flex items-center gap-2">
            <Files className="w-3.5 h-3.5 text-kano-accent" />
            <span>All Notes</span>
          </div>
          {totalNotesCount > 0 && (
            <span className="text-[10px] px-1 py-0.2 rounded bg-kano-bg text-kano-text-muted font-mono">
              {totalNotesCount}
            </span>
          )}
        </div>

        {/* Uncategorized filter */}
        <div
          onClick={() => onSelectFolder('uncategorized')}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${
            selectedFolderId === 'uncategorized'
              ? 'bg-kano-surface-hover text-kano-accent font-medium'
              : 'text-kano-text-secondary hover:bg-kano-surface-hover hover:text-kano-text-primary'
          }`}
        >
          <div className="flex items-center gap-2">
            <Inbox className="w-3.5 h-3.5 text-kano-text-muted" />
            <span>Uncategorized</span>
          </div>
          {uncategorizedNotesCount > 0 && (
            <span className="text-[10px] px-1 py-0.2 rounded bg-kano-bg text-kano-text-muted font-mono">
              {uncategorizedNotesCount}
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="my-1 border-b border-kano-border-subtle" />

        {/* Folder Tree Items */}
        {rootFolders.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-[11px] text-kano-text-muted">No folders created yet</p>
            <button
              type="button"
              onClick={() => onCreateFolder(null)}
              className="mt-1.5 text-xs sm:text-sm text-kano-accent hover:underline font-medium inline-block whitespace-nowrap"
            >
              + Create first folder
            </button>
          </div>
        ) : (
          rootFolders.map((folder) => renderFolderItem(folder, 0))
        )}
      </div>
    </div>
  );
};
