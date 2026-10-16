/**
 * demoData.ts — Isolated local demo dataset for shell navigation & initial layout
 *
 * NOTE: All data here is local demo scaffolding only.
 * It is never sent to Supabase and is designed to be swapped out
 * when the authoritative data provider is implemented in later phases.
 */

export interface DemoWorkspace {
  id: string;
  name: string;
  role: string;
  isDemo: true;
}

export interface DemoFolder {
  id: string;
  name: string;
  noteCount: number;
  children?: DemoFolder[];
}

export interface DemoFavorite {
  id: string;
  title: string;
  type: 'note' | 'task' | 'board';
  route: string;
}

export interface DemoCounts {
  notes: number;
  tasks: number;
  boardItems: number;
  calendarItems: number;
  activityCount: number;
  trashCount: number;
}

export const DEMO_WORKSPACES: DemoWorkspace[] = [
  {
    id: 'demo-ws-1',
    name: 'Personal Workspace',
    role: 'Owner',
    isDemo: true,
  },
  {
    id: 'demo-ws-2',
    name: 'Product Architecture (Demo)',
    role: 'Member',
    isDemo: true,
  },
];

export const DEMO_FOLDERS: DemoFolder[] = [
  {
    id: 'f-1',
    name: 'Research & Specs',
    noteCount: 4,
    children: [
      { id: 'f-1-1', name: 'Database Schemas', noteCount: 2 },
      { id: 'f-1-2', name: 'Contract Specs', noteCount: 2 },
    ],
  },
  {
    id: 'f-2',
    name: 'Product Roadmap',
    noteCount: 3,
  },
  {
    id: 'f-3',
    name: 'Daily Logs',
    noteCount: 5,
  },
];

export const DEMO_FAVORITES: DemoFavorite[] = [
  { id: 'fav-1', title: 'Desktop Shell Specification', type: 'note', route: '/notes' },
  { id: 'fav-2', title: 'Q4 Product Roadmap', type: 'board', route: '/board' },
];

export const DEMO_COUNTS: DemoCounts = {
  notes: 12,
  tasks: 8,
  boardItems: 6,
  calendarItems: 3,
  activityCount: 7,
  trashCount: 2,
};

export const DEMO_USER = {
  name: 'Local Demo User',
  email: 'offline@demo.local',
  role: 'Workspace Creator',
  avatarInitials: 'KD',
  isDemo: true,
};
