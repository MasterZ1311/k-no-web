/**
 * KanoDesktopAPI
 * The strictly-typed allowlisted bridge interface exposed to the React renderer
 * via contextBridge. Raw Node APIs, ipcRenderer, and direct Supabase sessions
 * are never exposed to the renderer process.
 */

export interface KanoUser {
  id: string;
  email: string;
  displayName: string | null;
  emailConfirmedAt: string | null;
}

export interface AuthStatus {
  isConfigured: boolean;
  user: KanoUser | null;
  error?: string | null;
}

export interface RoomDTO {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  role: 'owner' | 'member';
  createdAt: string;
  updatedAt: string;
}

export interface RoomMemberDTO {
  userId: string;
  roomId: string;
  role: 'owner' | 'member';
  joinedAt: string;
  displayName: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface InvitationTokenDTO {
  id: string;
  roomId: string;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  isRevoked: boolean;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Folders, Notes, and Attachments DTOs
// ----------------------------------------------------------------------------

export interface FolderDTO {
  id: string;
  roomId: string;
  parentId: string | null;
  name: string;
  position: number;
  isDeleted: boolean;
  deletedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  noteCount?: number;
}

export interface KanoDocContent {
  schemaVersion: 1;
  type: 'doc';
  content: Array<Record<string, unknown>>;
}

export interface NoteDTO {
  id: string;
  roomId: string;
  folderId: string | null;
  title: string;
  content: KanoDocContent;
  plainTextSummary: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentDTO {
  id: string;
  roomId: string;
  noteId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: string | null;
  createdAt: string;
  signedUrl?: string;
}

export interface NoteUpdateResult {
  success: boolean;
  conflict?: boolean;
  currentVersion?: number;
  currentNote?: NoteDTO;
  note?: NoteDTO;
  error?: string;
}

export interface ReminderDTO {
  id: string;
  roomId: string;
  taskId?: string | null;
  eventId?: string | null;
  triggerTime: string;
  offsetMinutes: number;
  status: 'pending' | 'delivered' | 'dismissed' | 'cancelled';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderDeliveryDTO {
  id: string;
  reminderId: string;
  userId: string;
  deviceId: string;
  deliveredAt: string;
  scheduledFor: string;
}

// ----------------------------------------------------------------------------
// Preload Bridge API Definitions
// ----------------------------------------------------------------------------

export interface KanoAuthAPI {
  getStatus: () => Promise<AuthStatus>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; user?: KanoUser; error?: string }>;
  signUp: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ success: boolean; user?: KanoUser; requiresEmailVerification?: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  onAuthStateChange: (callback: (status: AuthStatus) => void) => () => void;
}

export interface KanoRoomsAPI {
  getRooms: () => Promise<{ success: boolean; rooms: RoomDTO[]; error?: string }>;
  createRoom: (name: string, description?: string) => Promise<{ success: boolean; room?: RoomDTO; error?: string }>;
  getRoomMembers: (roomId: string) => Promise<{ success: boolean; members: RoomMemberDTO[]; error?: string }>;
  getInvitations: (roomId: string) => Promise<{ success: boolean; invitations: InvitationTokenDTO[]; error?: string }>;
  generateInvitation: (
    roomId: string,
    maxUses?: number,
    expiresAt?: string
  ) => Promise<{ success: boolean; token?: string; error?: string }>;
  revokeInvitation: (tokenId: string) => Promise<{ success: boolean; error?: string }>;
  removeMember: (roomId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  transferOwnership: (roomId: string, newOwnerId: string) => Promise<{ success: boolean; error?: string }>;
  redeemInvitation: (
    token: string
  ) => Promise<{ success: boolean; roomId?: string; alreadyMember?: boolean; error?: string }>;
}

export interface KanoFoldersAPI {
  getFolders: (roomId: string) => Promise<{ success: boolean; folders: FolderDTO[]; error?: string }>;
  createFolder: (
    roomId: string,
    name: string,
    parentId?: string | null
  ) => Promise<{ success: boolean; folder?: FolderDTO; error?: string }>;
  renameFolder: (folderId: string, name: string) => Promise<{ success: boolean; folder?: FolderDTO; error?: string }>;
  moveFolder: (
    folderId: string,
    newParentId: string | null
  ) => Promise<{ success: boolean; folder?: FolderDTO; error?: string }>;
  deleteFolder: (folderId: string) => Promise<{ success: boolean; error?: string }>;
}

export interface KanoNotesAPI {
  getNotes: (
    roomId: string,
    options?: { folderId?: string | null; isFavorite?: boolean; isPinned?: boolean }
  ) => Promise<{ success: boolean; notes: NoteDTO[]; error?: string }>;
  getNote: (noteId: string) => Promise<{ success: boolean; note?: NoteDTO; error?: string }>;
  createNote: (
    roomId: string,
    folderId?: string | null,
    title?: string,
    content?: KanoDocContent
  ) => Promise<{ success: boolean; note?: NoteDTO; error?: string }>;
  updateNoteWithVersion: (
    noteId: string,
    expectedVersion: number,
    title?: string,
    content?: KanoDocContent,
    folderId?: string | null
  ) => Promise<NoteUpdateResult>;
  moveNote: (noteId: string, folderId: string | null) => Promise<{ success: boolean; error?: string }>;
  toggleFavorite: (noteId: string, isFavorite: boolean) => Promise<{ success: boolean; error?: string }>;
  togglePin: (noteId: string, isPinned: boolean) => Promise<{ success: boolean; error?: string }>;
  trashNote: (noteId: string) => Promise<{ success: boolean; error?: string }>;
  restoreNote: (noteId: string) => Promise<{ success: boolean; error?: string }>;
  permanentlyDeleteNote: (noteId: string) => Promise<{ success: boolean; error?: string }>;
  getTrashNotes: (roomId: string) => Promise<{ success: boolean; notes: NoteDTO[]; error?: string }>;
  searchNotes: (roomId: string, query: string) => Promise<{ success: boolean; notes: NoteDTO[]; error?: string }>;
}

export interface KanoAttachmentsAPI {
  uploadAttachment: (
    roomId: string,
    noteId: string | null,
    filename: string,
    mimeType: string,
    fileBytes: ArrayBuffer
  ) => Promise<{ success: boolean; attachment?: AttachmentDTO; error?: string }>;
  getNoteAttachments: (noteId: string) => Promise<{ success: boolean; attachments: AttachmentDTO[]; error?: string }>;
  deleteAttachment: (attachmentId: string) => Promise<{ success: boolean; error?: string }>;
  getAttachmentSignedUrl: (storagePath: string) => Promise<{ success: boolean; signedUrl?: string; error?: string }>;
}

// ----------------------------------------------------------------------------
// Tasks, Boards, and Calendar DTOs
// ----------------------------------------------------------------------------

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface BoardDTO {
  id: string;
  roomId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardColumnDTO {
  id: string;
  boardId: string;
  roomId: string;
  name: string;
  statusKey: TaskStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskChecklistDTO {
  id: string;
  taskId: string;
  roomId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskLabelDTO {
  id: string;
  roomId: string;
  name: string;
  colorHex: string;
  createdAt: string;
}

export interface TaskDTO {
  id: string;
  roomId: string;
  columnId: string;
  status: TaskStatus;
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  folderId: string | null;
  noteId: string | null;
  position: number;
  isDeleted: boolean;
  deletedAt: string | null;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  checklists: TaskChecklistDTO[];
  labels: TaskLabelDTO[];
}

export interface CalendarEventDTO {
  id: string;
  roomId: string;
  taskId: string | null;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KanoTasksAPI {
  getTasks: (
    roomId: string,
    options?: { status?: TaskStatus; priority?: TaskPriority; search?: string }
  ) => Promise<{ success: boolean; tasks: TaskDTO[]; error?: string }>;
  getTask: (taskId: string) => Promise<{ success: boolean; task?: TaskDTO; error?: string }>;
  createTask: (
    roomId: string,
    payload: {
      title: string;
      columnId?: string;
      description?: string;
      priority?: TaskPriority;
      dueDate?: string | null;
      assigneeId?: string | null;
      folderId?: string | null;
      noteId?: string | null;
      labels?: string[];
    }
  ) => Promise<{ success: boolean; task?: TaskDTO; error?: string }>;
  updateTask: (
    taskId: string,
    payload: {
      title?: string;
      description?: string;
      priority?: TaskPriority;
      dueDate?: string | null;
      columnId?: string;
      status?: TaskStatus;
      assigneeId?: string | null;
      folderId?: string | null;
      noteId?: string | null;
    }
  ) => Promise<{ success: boolean; task?: TaskDTO; error?: string }>;
  deleteTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  getChecklists: (taskId: string) => Promise<{ success: boolean; checklists: TaskChecklistDTO[]; error?: string }>;
  createChecklistItem: (
    roomId: string,
    taskId: string,
    title: string
  ) => Promise<{ success: boolean; checklist?: TaskChecklistDTO; error?: string }>;
  updateChecklistItem: (
    checklistId: string,
    payload: { title?: string; isCompleted?: boolean; position?: number }
  ) => Promise<{ success: boolean; checklist?: TaskChecklistDTO; error?: string }>;
  deleteChecklistItem: (checklistId: string) => Promise<{ success: boolean; error?: string }>;
  getLabels: (roomId: string) => Promise<{ success: boolean; labels: TaskLabelDTO[]; error?: string }>;
  createLabel: (
    roomId: string,
    name: string,
    colorHex: string
  ) => Promise<{ success: boolean; label?: TaskLabelDTO; error?: string }>;
  deleteLabel: (labelId: string) => Promise<{ success: boolean; error?: string }>;
  assignLabel: (roomId: string, taskId: string, labelId: string) => Promise<{ success: boolean; error?: string }>;
  unassignLabel: (taskId: string, labelId: string) => Promise<{ success: boolean; error?: string }>;
}

export interface KanoBoardsAPI {
  getBoard: (
    roomId: string
  ) => Promise<{ success: boolean; board?: BoardDTO; columns: BoardColumnDTO[]; error?: string }>;
  moveTask: (
    taskId: string,
    targetColumnId: string,
    newPosition?: number
  ) => Promise<{ success: boolean; task?: TaskDTO; error?: string }>;
}

export interface KanoCalendarAPI {
  getEvents: (
    roomId: string,
    startRange?: string,
    endRange?: string
  ) => Promise<{ success: boolean; events: CalendarEventDTO[]; error?: string }>;
  createEvent: (
    roomId: string,
    payload: {
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      isAllDay?: boolean;
      taskId?: string | null;
    }
  ) => Promise<{ success: boolean; event?: CalendarEventDTO; error?: string }>;
  updateEvent: (
    eventId: string,
    payload: {
      title?: string;
      description?: string;
      startTime?: string;
      endTime?: string;
      isAllDay?: boolean;
      taskId?: string | null;
    }
  ) => Promise<{ success: boolean; event?: CalendarEventDTO; error?: string }>;
  deleteEvent: (eventId: string) => Promise<{ success: boolean; error?: string }>;
}

// ----------------------------------------------------------------------------
// Realtime Collaboration & Invalidation Types
// ----------------------------------------------------------------------------

export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type RealtimeTable =
  | 'notes'
  | 'folders'
  | 'tasks'
  | 'task_checklists'
  | 'task_labels'
  | 'task_label_assignments'
  | 'boards'
  | 'board_columns'
  | 'calendar_events'
  | 'room_members'
  | 'activity_logs';

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeInvalidationEvent {
  roomId: string;
  table: RealtimeTable;
  eventType: RealtimeEventType;
  id?: string;
  timestamp: string;
}

export interface KanoRealtimeAPI {
  getStatus: () => Promise<RealtimeStatus>;
  subscribeRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  unsubscribeRoom: () => Promise<{ success: boolean; error?: string }>;
  onStatusChange: (callback: (status: RealtimeStatus) => void) => () => void;
  onInvalidation: (callback: (event: RealtimeInvalidationEvent) => void) => () => void;
}

// ----------------------------------------------------------------------------
// Settings & Desktop Preferences Types
// ----------------------------------------------------------------------------

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  sidebarCollapsed: boolean;
  notificationsEnabled: boolean;
  taskDueAlerts: boolean;
  roomActivityAlerts: boolean;
  reducedMotion: boolean;
  autoCheckUpdates: boolean;
  privacyPreviewMode?: boolean;
}

export interface KanoSettingsAPI {
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<{ success: boolean; settings: AppSettings; error?: string }>;
  clearCache: () => Promise<{ success: boolean; bytesFreed?: number; error?: string }>;
  onSettingsChange: (callback: (settings: AppSettings) => void) => () => void;
}

// ----------------------------------------------------------------------------
// Native Notifications Types
// ----------------------------------------------------------------------------

export interface NotificationPayload {
  id?: string;
  title: string;
  body: string;
  roomId?: string;
  route?: string;
  category?: 'task_due' | 'activity' | 'system';
  silent?: boolean;
}

export interface KanoNotificationsAPI {
  isSupported: () => Promise<boolean>;
  show: (notification: NotificationPayload) => Promise<{ success: boolean; shown: boolean; reason?: string }>;
  onNotificationClick: (callback: (payload: { roomId?: string; route?: string }) => void) => () => void;
}

export interface KanoRemindersAPI {
  getReminders: (roomId: string) => Promise<{ success: boolean; reminders: ReminderDTO[]; error?: string }>;
  createReminder: (
    roomId: string,
    payload: {
      taskId?: string | null;
      eventId?: string | null;
      triggerTime: string;
      offsetMinutes?: number;
    }
  ) => Promise<{ success: boolean; reminder?: ReminderDTO; error?: string }>;
  updateReminder: (
    reminderId: string,
    payload: {
      triggerTime?: string;
      offsetMinutes?: number;
      status?: 'pending' | 'delivered' | 'dismissed' | 'cancelled';
    }
  ) => Promise<{ success: boolean; reminder?: ReminderDTO; error?: string }>;
  deleteReminder: (reminderId: string) => Promise<{ success: boolean; error?: string }>;
}

export interface ActivityLogDTO {
  id: string;
  roomId: string;
  actorId: string | null;
  actorName?: string;
  actorEmail?: string;
  entityType: 'room' | 'folder' | 'note' | 'task' | 'attachment' | 'member' | 'board' | 'calendar_event';
  entityId: string;
  action: 'created' | 'updated' | 'deleted' | 'moved' | 'restored' | 'joined' | 'left' | 'removed' | 'exported';
  details: Record<string, unknown>;
  createdAt: string;
}

export interface KanoActivityAPI {
  getLogs: (roomId: string, limit?: number, offset?: number) => Promise<{ success: boolean; logs: ActivityLogDTO[]; error?: string }>;
  logAction: (
    roomId: string,
    entityType: string,
    entityId: string,
    action: string,
    details?: Record<string, unknown>
  ) => Promise<{ success: boolean; logId?: string; error?: string }>;
}

export interface ExportSummaryDTO {
  success: boolean;
  format: 'markdown' | 'json';
  exportedNotesCount: number;
  exportedFoldersCount: number;
  exportedAttachmentsCount: number;
  skippedCount: number;
  errors: string[];
  outputPath?: string;
}

export interface KanoExportAPI {
  exportNote: (noteId: string, format: 'markdown' | 'json') => Promise<{ success: boolean; content?: string; filename?: string; error?: string }>;
  exportRoom: (roomId: string, format: 'markdown' | 'json') => Promise<ExportSummaryDTO>;
}

export interface KanoDesktopAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  openExternal: (url: string) => Promise<boolean>;
  onNavigate: (callback: (route: string) => void) => () => void;
  log: (level: 'info' | 'warn' | 'error', message: string) => void;
  auth: KanoAuthAPI;
  rooms: KanoRoomsAPI;
  folders: KanoFoldersAPI;
  notes: KanoNotesAPI;
  attachments: KanoAttachmentsAPI;
  tasks: KanoTasksAPI;
  boards: KanoBoardsAPI;
  calendar: KanoCalendarAPI;
  realtime: KanoRealtimeAPI;
  settings: KanoSettingsAPI;
  notifications: KanoNotificationsAPI;
  reminders: KanoRemindersAPI;
  activity: KanoActivityAPI;
  export: KanoExportAPI;
}

