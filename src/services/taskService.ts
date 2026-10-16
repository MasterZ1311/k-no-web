import { SupabaseManager, defaultSupabaseManager } from './supabaseClient';
import type {
  TaskDTO,
  TaskStatus,
  TaskPriority,
  BoardDTO,
  BoardColumnDTO,
  TaskChecklistDTO,
  TaskLabelDTO,
} from '../preload/types';

interface RawTaskRow {
  id: string;
  room_id: string;
  column_id: string;
  status: TaskStatus;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  assignee_id: string | null;
  folder_id: string | null;
  note_id: string | null;
  position: number;
  is_deleted: boolean;
  deleted_at: string | null;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface RawBoardRow {
  id: string;
  room_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface RawBoardColumnRow {
  id: string;
  board_id: string;
  room_id: string;
  name: string;
  status_key: TaskStatus;
  position: number;
  created_at: string;
  updated_at: string;
}

interface RawChecklistRow {
  id: string;
  task_id: string;
  room_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

interface RawLabelRow {
  id: string;
  room_id: string;
  name: string;
  color_hex: string;
  created_at: string;
}

export function mapRawTask(
  row: RawTaskRow,
  checklists: TaskChecklistDTO[] = [],
  labels: TaskLabelDTO[] = []
): TaskDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    columnId: row.column_id,
    status: row.status,
    title: row.title,
    description: row.description,
    priority: row.priority,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    assigneeId: row.assignee_id,
    folderId: row.folder_id,
    noteId: row.note_id,
    position: row.position,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    checklists,
    labels,
  };
}

export function mapRawBoard(row: RawBoardRow): BoardDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRawBoardColumn(row: RawBoardColumnRow): BoardColumnDTO {
  return {
    id: row.id,
    boardId: row.board_id,
    roomId: row.room_id,
    name: row.name,
    statusKey: row.status_key,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRawChecklist(row: RawChecklistRow): TaskChecklistDTO {
  return {
    id: row.id,
    taskId: row.task_id,
    roomId: row.room_id,
    title: row.title,
    isCompleted: row.is_completed,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRawLabel(row: RawLabelRow): TaskLabelDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    colorHex: row.color_hex,
    createdAt: row.created_at,
  };
}

export class TaskService {
  private manager: SupabaseManager;

  constructor(manager: SupabaseManager = defaultSupabaseManager) {
    this.manager = manager;
  }

  // --------------------------------------------------------------------------
  // Board & Column Operations
  // --------------------------------------------------------------------------

  public async getBoard(
    roomId: string
  ): Promise<{ success: boolean; board?: BoardDTO; columns: BoardColumnDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, columns: [], error: 'Backend is not configured.' };
    }
    if (!roomId || typeof roomId !== 'string') {
      return { success: false, columns: [], error: 'Valid roomId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      // Find board for room
      const { data: boards, error: boardError } = await client
        .from('boards')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (boardError) {
        return { success: false, columns: [], error: boardError.message };
      }

      let boardRow: RawBoardRow;
      if (!boards || boards.length === 0) {
        // Fallback: create board if absent
        const { data: newBoard, error: createError } = await client
          .from('boards')
          .insert({ room_id: roomId, name: 'Main Board' })
          .select()
          .single();

        if (createError || !newBoard) {
          return { success: false, columns: [], error: createError?.message || 'Failed to initialize board.' };
        }
        boardRow = newBoard as RawBoardRow;

        // Ensure 4 columns exist for the newly created board
        const defaultColumns = [
          { board_id: boardRow.id, room_id: roomId, name: 'To Do', status_key: 'todo', position: 0 },
          { board_id: boardRow.id, room_id: roomId, name: 'In Progress', status_key: 'in_progress', position: 1 },
          { board_id: boardRow.id, room_id: roomId, name: 'Blocked', status_key: 'blocked', position: 2 },
          { board_id: boardRow.id, room_id: roomId, name: 'Done', status_key: 'done', position: 3 },
        ];
        await client.from('board_columns').insert(defaultColumns);
      } else {
        boardRow = boards[0] as RawBoardRow;
      }

      // Fetch columns
      const { data: columns, error: colError } = await client
        .from('board_columns')
        .select('*')
        .eq('board_id', boardRow.id)
        .order('position', { ascending: true });

      if (colError) {
        return { success: false, columns: [], error: colError.message };
      }

      return {
        success: true,
        board: mapRawBoard(boardRow),
        columns: (columns as RawBoardColumnRow[]).map(mapRawBoardColumn),
      };
    } catch (err) {
      return {
        success: false,
        columns: [],
        error: err instanceof Error ? err.message : 'Failed to retrieve Kanban board.',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Tasks CRUD
  // --------------------------------------------------------------------------

  public async getTasks(
    roomId: string,
    options?: { status?: TaskStatus; priority?: TaskPriority; search?: string }
  ): Promise<{ success: boolean; tasks: TaskDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, tasks: [], error: 'Backend is not configured.' };
    }
    if (!roomId || typeof roomId !== 'string') {
      return { success: false, tasks: [], error: 'Valid roomId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      let query = client
        .from('tasks')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_deleted', false);

      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.priority) {
        query = query.eq('priority', options.priority);
      }
      if (options?.search && options.search.trim()) {
        query = query.ilike('title', `%${options.search.trim()}%`);
      }

      const { data: rawTasks, error: tasksError } = await query
        .order('position', { ascending: true })
        .order('created_at', { ascending: false });

      if (tasksError) {
        return { success: false, tasks: [], error: tasksError.message };
      }

      if (!rawTasks || rawTasks.length === 0) {
        return { success: true, tasks: [] };
      }

      const taskIds = rawTasks.map((t: RawTaskRow) => t.id);

      // Fetch checklists for all tasks
      const { data: rawChecklists, error: checkError } = await client
        .from('task_checklists')
        .select('*')
        .in('task_id', taskIds)
        .order('position', { ascending: true });

      if (checkError) {
        return { success: false, tasks: [], error: checkError.message };
      }

      const checklistsByTask = new Map<string, TaskChecklistDTO[]>();
      for (const item of (rawChecklists as RawChecklistRow[]) || []) {
        const mapped = mapRawChecklist(item);
        const list = checklistsByTask.get(item.task_id) || [];
        list.push(mapped);
        checklistsByTask.set(item.task_id, list);
      }

      // Fetch label assignments + label info
      const { data: rawAssignments, error: assignError } = await client
        .from('task_label_assignments')
        .select('task_id, label_id, task_labels ( id, room_id, name, color_hex, created_at )')
        .in('task_id', taskIds);

      if (assignError) {
        return { success: false, tasks: [], error: assignError.message };
      }

      const labelsByTask = new Map<string, TaskLabelDTO[]>();
      for (const assign of (rawAssignments as unknown as Array<{ task_id: string; task_labels: RawLabelRow | RawLabelRow[] | null }>) || []) {
        const rawLabel = Array.isArray(assign.task_labels) ? assign.task_labels[0] : assign.task_labels;
        if (rawLabel) {
          const mapped = mapRawLabel(rawLabel);
          const list = labelsByTask.get(assign.task_id) || [];
          list.push(mapped);
          labelsByTask.set(assign.task_id, list);
        }
      }

      const mappedTasks: TaskDTO[] = (rawTasks as RawTaskRow[]).map((row) =>
        mapRawTask(row, checklistsByTask.get(row.id) || [], labelsByTask.get(row.id) || [])
      );

      return { success: true, tasks: mappedTasks };
    } catch (err) {
      return {
        success: false,
        tasks: [],
        error: err instanceof Error ? err.message : 'Failed to retrieve tasks.',
      };
    }
  }

  public async getTask(taskId: string): Promise<{ success: boolean; task?: TaskDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!taskId || typeof taskId !== 'string') {
      return { success: false, error: 'Valid taskId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data: rawTask, error: taskError } = await client
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .eq('is_deleted', false)
        .single();

      if (taskError || !rawTask) {
        return { success: false, error: taskError?.message || 'Task not found.' };
      }

      const checkRes = await this.getChecklists(taskId);
      const checklists = checkRes.success ? checkRes.checklists : [];

      // Fetch labels
      const { data: rawAssignments } = await client
        .from('task_label_assignments')
        .select('label_id, task_labels ( id, room_id, name, color_hex, created_at )')
        .eq('task_id', taskId);

      const labels: TaskLabelDTO[] = [];
      for (const a of (rawAssignments as unknown as Array<{ label_id: string; task_labels: RawLabelRow | RawLabelRow[] | null }>) || []) {
        const l = Array.isArray(a.task_labels) ? a.task_labels[0] : a.task_labels;
        if (l) labels.push(mapRawLabel(l));
      }

      return {
        success: true,
        task: mapRawTask(rawTask as RawTaskRow, checklists, labels),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve task.',
      };
    }
  }

  public async createTask(
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
  ): Promise<{ success: boolean; task?: TaskDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!roomId || typeof roomId !== 'string') {
      return { success: false, error: 'Valid roomId is required.' };
    }
    if (!payload.title || !payload.title.trim()) {
      return { success: false, error: 'Task title cannot be empty.' };
    }

    const client = this.manager.getClient()!;
    try {
      let targetColumnId = payload.columnId;

      // If no columnId provided, resolve the default "todo" column for the room
      if (!targetColumnId) {
        const boardRes = await this.getBoard(roomId);
        if (!boardRes.success || !boardRes.columns.length) {
          return { success: false, error: 'No board columns found for room.' };
        }
        const todoCol = boardRes.columns.find((c) => c.statusKey === 'todo') || boardRes.columns[0];
        targetColumnId = todoCol.id;
      }

      // Determine initial position (at end of column)
      const { count } = await client
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('column_id', targetColumnId)
        .eq('is_deleted', false);

      const newPosition = count || 0;

      const insertPayload: Record<string, unknown> = {
        room_id: roomId,
        column_id: targetColumnId,
        title: payload.title.trim(),
        description: payload.description ? payload.description.trim() : null,
        priority: payload.priority || 'medium',
        due_date: payload.dueDate || null,
        assignee_id: payload.assigneeId || null,
        folder_id: payload.folderId || null,
        note_id: payload.noteId || null,
        position: newPosition,
      };

      const { data: inserted, error: insertError } = await client
        .from('tasks')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError || !inserted) {
        return { success: false, error: insertError?.message || 'Failed to create task.' };
      }

      const newTask = inserted as RawTaskRow;

      // Handle label assignments if provided
      const assignedLabels: TaskLabelDTO[] = [];
      if (Array.isArray(payload.labels) && payload.labels.length > 0) {
        for (const labelId of payload.labels) {
          const assignRes = await this.assignLabel(roomId, newTask.id, labelId);
          if (assignRes.success) {
            // Find label details
            const { data: labelRow } = await client
              .from('task_labels')
              .select('*')
              .eq('id', labelId)
              .single();
            if (labelRow) {
              assignedLabels.push(mapRawLabel(labelRow as RawLabelRow));
            }
          }
        }
      }

      return {
        success: true,
        task: mapRawTask(newTask, [], assignedLabels),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create task.',
      };
    }
  }

  public async updateTask(
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
  ): Promise<{ success: boolean; task?: TaskDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!taskId || typeof taskId !== 'string') {
      return { success: false, error: 'Valid taskId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const updateData: Record<string, unknown> = {};

      if (payload.title !== undefined) {
        if (!payload.title.trim()) {
          return { success: false, error: 'Task title cannot be empty.' };
        }
        updateData.title = payload.title.trim();
      }
      if (payload.description !== undefined) {
        updateData.description = payload.description ? payload.description.trim() : null;
      }
      if (payload.priority !== undefined) {
        updateData.priority = payload.priority;
      }
      if (payload.dueDate !== undefined) {
        updateData.due_date = payload.dueDate;
      }
      if (payload.columnId !== undefined) {
        updateData.column_id = payload.columnId;
      }
      if (payload.assigneeId !== undefined) {
        updateData.assignee_id = payload.assigneeId;
      }
      if (payload.folderId !== undefined) {
        updateData.folder_id = payload.folderId;
      }
      if (payload.noteId !== undefined) {
        updateData.note_id = payload.noteId;
      }

      const { data: updated, error: updateError } = await client
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()
        .single();

      if (updateError || !updated) {
        return { success: false, error: updateError?.message || 'Failed to update task.' };
      }

      // Re-fetch complete task with checklists & labels
      return this.getTask(taskId);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update task.',
      };
    }
  }

  public async deleteTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!taskId || typeof taskId !== 'string') {
      return { success: false, error: 'Valid taskId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { error } = await client
        .from('tasks')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete task.',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Kanban Move RPC
  // --------------------------------------------------------------------------

  public async moveTask(
    taskId: string,
    targetColumnId: string,
    newPosition = 0
  ): Promise<{ success: boolean; task?: TaskDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!taskId || !targetColumnId) {
      return { success: false, error: 'taskId and targetColumnId are required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data: rpcResult, error: rpcError } = await client.rpc('move_task', {
        p_task_id: taskId,
        p_column_id: targetColumnId,
        p_position: newPosition,
      });

      if (rpcError) {
        return { success: false, error: rpcError.message };
      }

      if (!rpcResult || rpcResult.success === false) {
        return { success: false, error: rpcResult?.error || 'Failed to move task.' };
      }

      // Re-fetch the task to ensure checklists and labels are attached
      return this.getTask(taskId);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to move task.',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Checklists CRUD
  // --------------------------------------------------------------------------

  public async getChecklists(
    taskId: string
  ): Promise<{ success: boolean; checklists: TaskChecklistDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, checklists: [], error: 'Backend is not configured.' };
    }
    if (!taskId) {
      return { success: false, checklists: [], error: 'Valid taskId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client
        .from('task_checklists')
        .select('*')
        .eq('task_id', taskId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        return { success: false, checklists: [], error: error.message };
      }

      return {
        success: true,
        checklists: (data as RawChecklistRow[]).map(mapRawChecklist),
      };
    } catch (err) {
      return {
        success: false,
        checklists: [],
        error: err instanceof Error ? err.message : 'Failed to get checklists.',
      };
    }
  }

  public async createChecklistItem(
    roomId: string,
    taskId: string,
    title: string
  ): Promise<{ success: boolean; checklist?: TaskChecklistDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!roomId || !taskId) {
      return { success: false, error: 'Valid roomId and taskId are required.' };
    }
    if (!title || !title.trim()) {
      return { success: false, error: 'Checklist item title cannot be empty.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { count } = await client
        .from('task_checklists')
        .select('id', { count: 'exact', head: true })
        .eq('task_id', taskId);

      const position = count || 0;

      const { data, error } = await client
        .from('task_checklists')
        .insert({
          room_id: roomId,
          task_id: taskId,
          title: title.trim(),
          is_completed: false,
          position,
        })
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to create checklist item.' };
      }

      return {
        success: true,
        checklist: mapRawChecklist(data as RawChecklistRow),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create checklist item.',
      };
    }
  }

  public async updateChecklistItem(
    checklistId: string,
    payload: { title?: string; isCompleted?: boolean; position?: number }
  ): Promise<{ success: boolean; checklist?: TaskChecklistDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!checklistId) {
      return { success: false, error: 'Valid checklistId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const updateData: Record<string, unknown> = {};
      if (payload.title !== undefined) {
        if (!payload.title.trim()) {
          return { success: false, error: 'Title cannot be empty.' };
        }
        updateData.title = payload.title.trim();
      }
      if (payload.isCompleted !== undefined) {
        updateData.is_completed = payload.isCompleted;
      }
      if (payload.position !== undefined) {
        updateData.position = payload.position;
      }

      const { data, error } = await client
        .from('task_checklists')
        .update(updateData)
        .eq('id', checklistId)
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to update checklist item.' };
      }

      return {
        success: true,
        checklist: mapRawChecklist(data as RawChecklistRow),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update checklist item.',
      };
    }
  }

  public async deleteChecklistItem(checklistId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!checklistId) {
      return { success: false, error: 'Valid checklistId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { error } = await client.from('task_checklists').delete().eq('id', checklistId);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete checklist item.',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Labels CRUD & Assignments
  // --------------------------------------------------------------------------

  public async getLabels(
    roomId: string
  ): Promise<{ success: boolean; labels: TaskLabelDTO[]; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, labels: [], error: 'Backend is not configured.' };
    }
    if (!roomId) {
      return { success: false, labels: [], error: 'Valid roomId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client
        .from('task_labels')
        .select('*')
        .eq('room_id', roomId)
        .order('name', { ascending: true });

      if (error) {
        return { success: false, labels: [], error: error.message };
      }

      return {
        success: true,
        labels: (data as RawLabelRow[]).map(mapRawLabel),
      };
    } catch (err) {
      return {
        success: false,
        labels: [],
        error: err instanceof Error ? err.message : 'Failed to get labels.',
      };
    }
  }

  public async createLabel(
    roomId: string,
    name: string,
    colorHex: string
  ): Promise<{ success: boolean; label?: TaskLabelDTO; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!roomId) {
      return { success: false, error: 'Valid roomId is required.' };
    }
    if (!name || !name.trim()) {
      return { success: false, error: 'Label name cannot be empty.' };
    }
    const cleanHex = colorHex.trim();
    if (!/^#[0-9a-f]{6}$/i.test(cleanHex)) {
      return { success: false, error: 'Label color must be a valid 6-character hex code (e.g. #3b82f6).' };
    }

    const client = this.manager.getClient()!;
    try {
      const { data, error } = await client
        .from('task_labels')
        .insert({
          room_id: roomId,
          name: name.trim(),
          color_hex: cleanHex.toLowerCase(),
        })
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to create label.' };
      }

      return {
        success: true,
        label: mapRawLabel(data as RawLabelRow),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create label.',
      };
    }
  }

  public async deleteLabel(labelId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!labelId) {
      return { success: false, error: 'Valid labelId is required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { error } = await client.from('task_labels').delete().eq('id', labelId);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete label.',
      };
    }
  }

  public async assignLabel(
    roomId: string,
    taskId: string,
    labelId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!roomId || !taskId || !labelId) {
      return { success: false, error: 'Valid roomId, taskId, and labelId are required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { error } = await client
        .from('task_label_assignments')
        .upsert({ room_id: roomId, task_id: taskId, label_id: labelId });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to assign label.',
      };
    }
  }

  public async unassignLabel(taskId: string, labelId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.manager.isConfigured()) {
      return { success: false, error: 'Backend is not configured.' };
    }
    if (!taskId || !labelId) {
      return { success: false, error: 'Valid taskId and labelId are required.' };
    }

    const client = this.manager.getClient()!;
    try {
      const { error } = await client
        .from('task_label_assignments')
        .delete()
        .eq('task_id', taskId)
        .eq('label_id', labelId);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to unassign label.',
      };
    }
  }
}

export const defaultTaskService = new TaskService(defaultSupabaseManager);
