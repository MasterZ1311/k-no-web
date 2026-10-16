export type RoutePath =
  | '/notes'
  | '/tasks'
  | '/board'
  | '/calendar'
  | '/activity'
  | '/favorites'
  | '/trash'
  | '/settings';

export interface RouteMeta {
  path: RoutePath;
  title: string;
  description: string;
  breadcrumb: string;
}

export const ROUTES: Record<RoutePath, RouteMeta> = {
  '/notes': {
    path: '/notes',
    title: 'Notes & Documents',
    description: 'Structured thinking and rich-text records organized by folder hierarchy.',
    breadcrumb: 'Notes',
  },
  '/tasks': {
    path: '/tasks',
    title: 'Tasks & Checklists',
    description: 'Actionable items, priorities, checklists, and deadline tracking.',
    breadcrumb: 'Tasks',
  },
  '/board': {
    path: '/board',
    title: 'Kanban Board',
    description: 'Visual workflow progress across To Do, In Progress, Blocked, and Done.',
    breadcrumb: 'Board',
  },
  '/calendar': {
    path: '/calendar',
    title: 'Calendar & Schedule',
    description: 'Time-bound events, task milestones, and scheduled deadlines.',
    breadcrumb: 'Calendar',
  },
  '/activity': {
    path: '/activity',
    title: 'Activity Stream',
    description: 'Immutable room audit history recording creations, updates, and invitations.',
    breadcrumb: 'Activity',
  },
  '/favorites': {
    path: '/favorites',
    title: 'Pinned Favorites',
    description: 'Quick-access bookmarks for frequently consulted documents and boards.',
    breadcrumb: 'Favorites',
  },
  '/trash': {
    path: '/trash',
    title: 'Trash & Recovery',
    description: 'Soft-deleted notes, tasks, and attachments awaiting restoration or purge.',
    breadcrumb: 'Trash',
  },
  '/settings': {
    path: '/settings',
    title: 'Workspace Settings',
    description: 'Local desktop preferences, keyboard shortcuts, and client information.',
    breadcrumb: 'Settings',
  },
};
