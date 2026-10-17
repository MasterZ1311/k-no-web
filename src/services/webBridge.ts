import type { KanoDesktopAPI } from '../preload/types';
import { defaultAuthService } from './authService';
import { defaultRoomService } from './roomService';
import { defaultFolderService } from './folderService';
import { defaultNoteService } from './noteService';
import { defaultAttachmentService } from './attachmentService';
import { defaultTaskService } from './taskService';
import { defaultCalendarService } from './calendarService';
import { defaultRealtimeService } from './realtimeService';
import { defaultSettingsService } from './settingsService';
import { defaultNotificationService } from './notificationService';
import { defaultReminderService } from './reminderService';
import { defaultActivityService } from './activityService';
import { defaultExportService } from './exportService';

const navigationListeners = new Set<(route: string) => void>();

export const webBridge: KanoDesktopAPI = {
  getAppVersion: async () => '1.0.0-web',
  getPlatform: async () => 'web',
  openExternal: async (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }
    return false;
  },
  onNavigate: (callback: (route: string) => void) => {
    navigationListeners.add(callback);
    return () => {
      navigationListeners.delete(callback);
    };
  },
  log: (level: 'info' | 'warn' | 'error', message: string) => {
    if (level === 'error') console.error(`[káno̱ web] ${message}`);
    else if (level === 'warn') console.warn(`[káno̱ web] ${message}`);
    else console.info(`[káno̱ web] ${message}`);
  },

  auth: {
    getStatus: () => defaultAuthService.getStatus(),
    signIn: (email, password) => defaultAuthService.signIn(email, password),
    signUp: (email, password, displayName) => defaultAuthService.signUp(email, password, displayName),
    signOut: () => defaultAuthService.signOut(),
    resetPasswordForEmail: (email) => defaultAuthService.resetPasswordForEmail(email),
    updatePassword: (newPassword) => defaultAuthService.updatePassword(newPassword),
    onAuthStateChange: (callback) => defaultAuthService.onAuthStateChange(callback),
  },

  rooms: {
    getRooms: () => defaultRoomService.getRooms(),
    createRoom: (name, description) => defaultRoomService.createRoom(name, description),
    getRoomMembers: (roomId) => defaultRoomService.getRoomMembers(roomId),
    getInvitations: (roomId) => defaultRoomService.getInvitations(roomId),
    generateInvitation: (roomId, maxUses, expiresAt) =>
      defaultRoomService.generateInvitation(roomId, maxUses, expiresAt),
    revokeInvitation: (tokenId) => defaultRoomService.revokeInvitation(tokenId),
    removeMember: (roomId, targetUserId) => defaultRoomService.removeMember(roomId, targetUserId),
    transferOwnership: (roomId, newOwnerId) => defaultRoomService.transferOwnership(roomId, newOwnerId),
    redeemInvitation: (token) => defaultRoomService.redeemInvitation(token),
  },

  folders: {
    getFolders: (roomId) => defaultFolderService.getFolders(roomId),
    createFolder: (roomId, name, parentId) => defaultFolderService.createFolder(roomId, name, parentId),
    renameFolder: (folderId, name) => defaultFolderService.renameFolder(folderId, name),
    moveFolder: (folderId, newParentId) => defaultFolderService.moveFolder(folderId, newParentId),
    deleteFolder: (folderId) => defaultFolderService.deleteFolder(folderId),
  },

  notes: {
    getNotes: (roomId, options) => defaultNoteService.getNotes(roomId, options),
    getNote: (noteId) => defaultNoteService.getNote(noteId),
    createNote: (roomId, folderId, title, content) =>
      defaultNoteService.createNote(roomId, folderId, title, content),
    updateNoteWithVersion: (noteId, expectedVersion, title, content, folderId) =>
      defaultNoteService.updateNoteWithVersion(noteId, expectedVersion, title, content, folderId),
    moveNote: (noteId, folderId) => defaultNoteService.moveNote(noteId, folderId),
    toggleFavorite: (noteId, isFavorite) => defaultNoteService.toggleFavorite(noteId, isFavorite),
    togglePin: (noteId, isPinned) => defaultNoteService.togglePin(noteId, isPinned),
    trashNote: (noteId) => defaultNoteService.trashNote(noteId),
    restoreNote: (noteId) => defaultNoteService.restoreNote(noteId),
    permanentlyDeleteNote: (noteId) => defaultNoteService.permanentlyDeleteNote(noteId),
    getTrashNotes: (roomId) => defaultNoteService.getTrashNotes(roomId),
    searchNotes: (roomId, query) => defaultNoteService.searchNotes(roomId, query),
  },

  attachments: {
    uploadAttachment: (roomId, noteId, filename, mimeType, fileBytes) =>
      defaultAttachmentService.uploadAttachment(roomId, noteId, filename, mimeType, fileBytes),
    getNoteAttachments: (noteId) => defaultAttachmentService.getNoteAttachments(noteId),
    deleteAttachment: (attachmentId) => defaultAttachmentService.deleteAttachment(attachmentId),
    getAttachmentSignedUrl: (storagePath) => defaultAttachmentService.getAttachmentSignedUrl(storagePath),
  },

  tasks: {
    getTasks: (roomId, options) => defaultTaskService.getTasks(roomId, options),
    getTask: (taskId) => defaultTaskService.getTask(taskId),
    createTask: (roomId, payload) => defaultTaskService.createTask(roomId, payload),
    updateTask: (taskId, payload) => defaultTaskService.updateTask(taskId, payload),
    deleteTask: (taskId) => defaultTaskService.deleteTask(taskId),
    getChecklists: (taskId) => defaultTaskService.getChecklists(taskId),
    createChecklistItem: (roomId, taskId, title) =>
      defaultTaskService.createChecklistItem(roomId, taskId, title),
    updateChecklistItem: (checklistId, payload) =>
      defaultTaskService.updateChecklistItem(checklistId, payload),
    deleteChecklistItem: (checklistId) => defaultTaskService.deleteChecklistItem(checklistId),
    getLabels: (roomId) => defaultTaskService.getLabels(roomId),
    createLabel: (roomId, name, colorHex) => defaultTaskService.createLabel(roomId, name, colorHex),
    deleteLabel: (labelId) => defaultTaskService.deleteLabel(labelId),
    assignLabel: (roomId, taskId, labelId) => defaultTaskService.assignLabel(roomId, taskId, labelId),
    unassignLabel: (taskId, labelId) => defaultTaskService.unassignLabel(taskId, labelId),
  },

  boards: {
    getBoard: (roomId) => defaultTaskService.getBoard(roomId),
    moveTask: (taskId, targetColumnId, newPosition) =>
      defaultTaskService.moveTask(taskId, targetColumnId, newPosition),
  },

  calendar: {
    getEvents: (roomId, startRange, endRange) => defaultCalendarService.getEvents(roomId, startRange, endRange),
    createEvent: (roomId, payload) => defaultCalendarService.createEvent(roomId, payload),
    updateEvent: (eventId, payload) => defaultCalendarService.updateEvent(eventId, payload),
    deleteEvent: (eventId) => defaultCalendarService.deleteEvent(eventId),
  },

  realtime: {
    getStatus: async () => defaultRealtimeService.getStatus(),
    subscribeRoom: (roomId) => defaultRealtimeService.subscribeRoom(roomId),
    unsubscribeRoom: () => defaultRealtimeService.unsubscribeRoom(),
    onStatusChange: (callback) => defaultRealtimeService.onStatusChange(callback),
    onInvalidation: (callback) => defaultRealtimeService.onInvalidation(callback),
    trackPresence: (state) => defaultRealtimeService.trackPresence(state),
    getPresenceState: () => defaultRealtimeService.getPresenceState(),
    onPresenceChange: (callback) => defaultRealtimeService.onPresenceChange(callback),
    broadcastComment: (comment) => defaultRealtimeService.broadcastComment(comment),
    onCommentBroadcast: (callback) => defaultRealtimeService.onCommentBroadcast(callback),
  },

  settings: {
    getSettings: () => defaultSettingsService.getSettings(),
    updateSettings: (settings) => defaultSettingsService.updateSettings(settings),
    clearCache: () => defaultSettingsService.clearCache(),
    onSettingsChange: (callback) => defaultSettingsService.onSettingsChange(callback),
  },

  notifications: {
    isSupported: async () => defaultNotificationService.isSupported(),
    show: (payload) => defaultNotificationService.show(payload),
    onNotificationClick: (callback) => defaultNotificationService.onNotificationClick(callback),
  },

  reminders: {
    getReminders: (roomId) => defaultReminderService.getReminders(roomId),
    createReminder: (roomId, payload) => defaultReminderService.createReminder(roomId, payload),
    updateReminder: (reminderId, payload) => defaultReminderService.updateReminder(reminderId, payload),
    deleteReminder: (reminderId) => defaultReminderService.deleteReminder(reminderId),
  },

  activity: {
    getLogs: (roomId, limit, offset) => defaultActivityService.getActivityLogs(roomId, limit, offset),
    logAction: (roomId, entityType, entityId, action, details) =>
      defaultActivityService.logAction(roomId, entityType, entityId, action, details),
  },

  export: {
    exportNote: (noteId, format) => defaultExportService.exportNote(noteId, format),
    exportRoom: (roomId, format) => defaultExportService.exportRoom(roomId, format),
  },
};

// Mount automatically on window in browser environment
if (typeof window !== 'undefined') {
  window.kanoDesktop = webBridge;
}
