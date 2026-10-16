-- ==============================================================================
-- káno̱ Migration: 20261011060025_content_and_productivity.sql
-- Description: Domain foundation: folders, rich-text notes (kano/doc/v1),
--              attachments, boards, Kanban columns, tasks, checklists, labels,
--              calendar events, reminders, delivery tracking, and activity history.
-- Traceability: REQ-NOT-01 through REQ-NOT-08, REQ-TSK-01 through REQ-TSK-06,
--               REQ-CAL-01 through REQ-CAL-05, REQ-COL-01, REQ-COL-02, REQ-OFF-01
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table: folders
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 120),
    position INT NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.folders IS 'Hierarchical nested folders for structured note organization.';

CREATE INDEX IF NOT EXISTS idx_folders_room_parent ON public.folders(room_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_room_deleted ON public.folders(room_id, is_deleted);

CREATE TRIGGER trg_folders_updated_at
BEFORE UPDATE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- Folder Hierarchy Validation & Cycle Prevention Trigger
CREATE OR REPLACE FUNCTION public.check_folder_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_room_id UUID;
    v_current_parent UUID;
    v_depth INT := 0;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.id IS NOT NULL AND NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'A folder cannot be its own parent.';
    END IF;

    -- Validate parent exists and belongs to the exact same room
    SELECT room_id INTO v_parent_room_id
    FROM public.folders
    WHERE id = NEW.parent_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent folder does not exist.';
    END IF;

    IF v_parent_room_id != NEW.room_id THEN
        RAISE EXCEPTION 'Parent folder must belong to the same room.';
    END IF;

    -- Detect direct and indirect cycles
    v_current_parent := NEW.parent_id;
    WHILE v_current_parent IS NOT NULL AND v_depth < 50 LOOP
        v_depth := v_depth + 1;
        IF NEW.id IS NOT NULL AND v_current_parent = NEW.id THEN
            RAISE EXCEPTION 'Circular folder reference detected.';
        END IF;

        SELECT parent_id INTO v_current_parent
        FROM public.folders
        WHERE id = v_current_parent;
    END LOOP;

    IF v_depth >= 50 THEN
        RAISE EXCEPTION 'Maximum folder nesting depth (50) exceeded or cycle detected.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_folder_cycle
BEFORE INSERT OR UPDATE OF parent_id, room_id ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.check_folder_hierarchy();

-- ------------------------------------------------------------------------------
-- 2. Table: notes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content JSONB NOT NULL DEFAULT '{"schemaVersion":1,"type":"doc","content":[]}'::jsonb,
    plain_text_summary TEXT,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT check_note_content_doc_shape CHECK (
        jsonb_typeof(content) = 'object'
        AND content->>'type' = 'doc'
        AND (content->>'schemaVersion')::int = 1
        AND jsonb_typeof(content->'content') = 'array'
    )
);

COMMENT ON TABLE public.notes IS 'Rich-text documents storing canonical kano/doc/v1 structured JSON AST.';

CREATE INDEX IF NOT EXISTS idx_notes_room_folder ON public.notes(room_id, folder_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_notes_room_deleted ON public.notes(room_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_notes_search ON public.notes USING gin(to_tsvector('english', title || ' ' || coalesce(plain_text_summary, '')));

-- Same-room folder link validation for notes
CREATE OR REPLACE FUNCTION public.validate_note_folder_room()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_folder_room_id UUID;
BEGIN
    IF NEW.folder_id IS NOT NULL THEN
        SELECT room_id INTO v_folder_room_id
        FROM public.folders
        WHERE id = NEW.folder_id;

        IF NOT FOUND OR v_folder_room_id != NEW.room_id THEN
            RAISE EXCEPTION 'Folder does not belong to the same room.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notes_validate_folder
BEFORE INSERT OR UPDATE OF folder_id, room_id ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.validate_note_folder_room();

-- Monotonic note version increment trigger
CREATE OR REPLACE FUNCTION public.increment_note_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.version := OLD.version + 1;
    NEW.updated_at := timezone('utc'::text, now());
    IF auth.uid() IS NOT NULL THEN
        NEW.updated_by := auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notes_version
BEFORE UPDATE OF title, content, folder_id, is_favorite, is_pinned, is_deleted ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.increment_note_version();

-- ------------------------------------------------------------------------------
-- 3. Table: attachments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
    filename TEXT NOT NULL CHECK (char_length(filename) >= 1),
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400),
    storage_path TEXT NOT NULL UNIQUE,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.attachments IS 'Metadata for files and media stored in Supabase Storage room-attachments bucket.';

CREATE INDEX IF NOT EXISTS idx_attachments_room_note ON public.attachments(room_id, note_id);

-- Same-room note link validation for attachments
CREATE OR REPLACE FUNCTION public.validate_attachment_room()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_note_room_id UUID;
BEGIN
    IF NEW.note_id IS NOT NULL THEN
        SELECT room_id INTO v_note_room_id
        FROM public.notes
        WHERE id = NEW.note_id;

        IF NOT FOUND OR v_note_room_id != NEW.room_id THEN
            RAISE EXCEPTION 'Associated note does not belong to the same room.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attachments_validate_room
BEFORE INSERT OR UPDATE OF note_id, room_id ON public.attachments
FOR EACH ROW EXECUTE FUNCTION public.validate_attachment_room();

-- ------------------------------------------------------------------------------
-- 4. Tables: boards & board_columns
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Main Board',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.boards IS 'Kanban boards associated with rooms.';

CREATE INDEX IF NOT EXISTS idx_boards_room_id ON public.boards(room_id);

CREATE TRIGGER trg_boards_updated_at
BEFORE UPDATE ON public.boards
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TABLE IF NOT EXISTS public.board_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status_key TEXT NOT NULL CHECK (status_key IN ('todo', 'in_progress', 'blocked', 'done')),
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_board_column_status UNIQUE (board_id, status_key)
);

COMMENT ON TABLE public.board_columns IS 'Columns of Kanban boards representing workflow stages.';

CREATE INDEX IF NOT EXISTS idx_board_columns_board ON public.board_columns(board_id, position);

-- Same-room validation for board_columns
CREATE OR REPLACE FUNCTION public.validate_board_column_room()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_board_room_id UUID;
BEGIN
    SELECT room_id INTO v_board_room_id
    FROM public.boards
    WHERE id = NEW.board_id;

    IF NOT FOUND OR v_board_room_id != NEW.room_id THEN
        RAISE EXCEPTION 'Board does not belong to the same room.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_board_columns_validate_room
BEFORE INSERT OR UPDATE OF board_id, room_id ON public.board_columns
FOR EACH ROW EXECUTE FUNCTION public.validate_board_column_room();

-- Automatic Board & 4 Columns Provisioning on Room Creation
CREATE OR REPLACE FUNCTION public.handle_room_default_board()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_board_id UUID;
BEGIN
    INSERT INTO public.boards (room_id, name)
    VALUES (NEW.id, 'Main Board')
    RETURNING id INTO v_board_id;

    INSERT INTO public.board_columns (board_id, room_id, name, status_key, position)
    VALUES
        (v_board_id, NEW.id, 'To Do', 'todo', 0),
        (v_board_id, NEW.id, 'In Progress', 'in_progress', 1),
        (v_board_id, NEW.id, 'Blocked', 'blocked', 2),
        (v_board_id, NEW.id, 'Done', 'done', 3);

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_on_room_created_board
AFTER INSERT ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.handle_room_default_board();

-- ------------------------------------------------------------------------------
-- 5. Table: tasks
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES public.board_columns(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
    title TEXT NOT NULL CHECK (char_length(trim(title)) >= 1),
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
    position INT NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.tasks IS 'The single authoritative record for tasks across lists, Kanban, calendar, and notes.';

CREATE INDEX IF NOT EXISTS idx_tasks_room_status ON public.tasks(room_id, status) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_tasks_room_due ON public.tasks(room_id, due_date) WHERE NOT is_deleted AND due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_column ON public.tasks(column_id, position) WHERE NOT is_deleted;

-- Same-room relationship validation for tasks
CREATE OR REPLACE FUNCTION public.validate_task_room_relationships()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_target_room_id UUID;
    v_col_status TEXT;
BEGIN
    -- Check column room
    SELECT room_id, status_key INTO v_target_room_id, v_col_status
    FROM public.board_columns
    WHERE id = NEW.column_id;

    IF NOT FOUND OR v_target_room_id != NEW.room_id THEN
        RAISE EXCEPTION 'Board column does not belong to the same room.';
    END IF;

    -- Ensure task status matches column status
    NEW.status := v_col_status;

    -- Auto-manage completed_at timestamp
    IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
        NEW.completed_at := timezone('utc'::text, now());
    ELSIF NEW.status != 'done' THEN
        NEW.completed_at := NULL;
    END IF;

    -- Check folder room
    IF NEW.folder_id IS NOT NULL THEN
        SELECT room_id INTO v_target_room_id
        FROM public.folders
        WHERE id = NEW.folder_id;

        IF NOT FOUND OR v_target_room_id != NEW.room_id THEN
            RAISE EXCEPTION 'Folder does not belong to the same room.';
        END IF;
    END IF;

    -- Check note room
    IF NEW.note_id IS NOT NULL THEN
        SELECT room_id INTO v_target_room_id
        FROM public.notes
        WHERE id = NEW.note_id;

        IF NOT FOUND OR v_target_room_id != NEW.room_id THEN
            RAISE EXCEPTION 'Note does not belong to the same room.';
        END IF;
    END IF;

    -- Check assignee membership
    IF NEW.assignee_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.room_members
            WHERE room_id = NEW.room_id AND user_id = NEW.assignee_id
        ) THEN
            RAISE EXCEPTION 'Task assignee must be a member of the room.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_validate_relationships
BEFORE INSERT OR UPDATE OF column_id, folder_id, note_id, assignee_id, room_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_task_room_relationships();

-- Monotonic task version increment trigger
CREATE OR REPLACE FUNCTION public.increment_task_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.version := OLD.version + 1;
    NEW.updated_at := timezone('utc'::text, now());
    IF auth.uid() IS NOT NULL THEN
        NEW.updated_by := auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_version
BEFORE UPDATE OF title, description, status, priority, due_date, assignee_id, column_id, folder_id, note_id, position, is_deleted ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.increment_task_version();

-- ------------------------------------------------------------------------------
-- 6. Table: task_checklists
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) >= 1),
    is_completed BOOLEAN NOT NULL DEFAULT false,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.task_checklists IS 'Checklist sub-items belonging to tasks.';

CREATE INDEX IF NOT EXISTS idx_task_checklists_task ON public.task_checklists(task_id, position);

CREATE TRIGGER trg_task_checklists_updated_at
BEFORE UPDATE ON public.task_checklists
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE OR REPLACE FUNCTION public.validate_checklist_task_room()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_task_room_id UUID;
BEGIN
    SELECT room_id INTO v_task_room_id
    FROM public.tasks
    WHERE id = NEW.task_id;

    IF NOT FOUND OR v_task_room_id != NEW.room_id THEN
        RAISE EXCEPTION 'Task does not belong to the same room.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_checklists_validate_room
BEFORE INSERT OR UPDATE OF task_id, room_id ON public.task_checklists
FOR EACH ROW EXECUTE FUNCTION public.validate_checklist_task_room();

-- ------------------------------------------------------------------------------
-- 7. Tables: task_labels & task_label_assignments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1),
    color_hex TEXT NOT NULL DEFAULT '#6B7280' CHECK (color_hex ~* '^#[0-9a-f]{6}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_room_label_name UNIQUE (room_id, name)
);

COMMENT ON TABLE public.task_labels IS 'Room-scoped labels for organizing and categorizing tasks.';

CREATE INDEX IF NOT EXISTS idx_task_labels_room ON public.task_labels(room_id);

CREATE TABLE IF NOT EXISTS public.task_label_assignments (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES public.task_labels(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

COMMENT ON TABLE public.task_label_assignments IS 'Join table assigning labels to tasks.';

CREATE OR REPLACE FUNCTION public.validate_label_assignment_room()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_task_room_id UUID;
    v_label_room_id UUID;
BEGIN
    SELECT room_id INTO v_task_room_id FROM public.tasks WHERE id = NEW.task_id;
    SELECT room_id INTO v_label_room_id FROM public.task_labels WHERE id = NEW.label_id;

    IF v_task_room_id IS NULL OR v_task_room_id != NEW.room_id THEN
        RAISE EXCEPTION 'Task does not belong to the same room.';
    END IF;
    IF v_label_room_id IS NULL OR v_label_room_id != NEW.room_id THEN
        RAISE EXCEPTION 'Label does not belong to the same room.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_label_assignments_validate_room
BEFORE INSERT OR UPDATE OF task_id, label_id, room_id ON public.task_label_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_label_assignment_room();

-- ------------------------------------------------------------------------------
-- 8. Table: calendar_events
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) >= 1),
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT check_calendar_event_times CHECK (end_time >= start_time)
);

COMMENT ON TABLE public.calendar_events IS 'Scheduled calendar events stored in UTC.';

CREATE INDEX IF NOT EXISTS idx_calendar_events_room_time ON public.calendar_events(room_id, start_time, end_time);

CREATE TRIGGER trg_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE OR REPLACE FUNCTION public.validate_calendar_event_room()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_task_room_id UUID;
BEGIN
    IF NEW.task_id IS NOT NULL THEN
        SELECT room_id INTO v_task_room_id
        FROM public.tasks
        WHERE id = NEW.task_id;

        IF NOT FOUND OR v_task_room_id != NEW.room_id THEN
            RAISE EXCEPTION 'Linked task does not belong to the same room.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calendar_events_validate_room
BEFORE INSERT OR UPDATE OF task_id, room_id ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.validate_calendar_event_room();

-- ------------------------------------------------------------------------------
-- 9. Tables: reminders & reminder_deliveries
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    trigger_time TIMESTAMPTZ NOT NULL,
    offset_minutes INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'dismissed', 'cancelled')),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT check_reminder_target_exists CHECK (task_id IS NOT NULL OR event_id IS NOT NULL)
);

COMMENT ON TABLE public.reminders IS 'Scheduled alert triggers for tasks or calendar events.';

CREATE INDEX IF NOT EXISTS idx_reminders_trigger ON public.reminders(trigger_time, status);
CREATE INDEX IF NOT EXISTS idx_reminders_room ON public.reminders(room_id);

CREATE TRIGGER trg_reminders_updated_at
BEFORE UPDATE ON public.reminders
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE OR REPLACE FUNCTION public.validate_reminder_room()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_target_room_id UUID;
BEGIN
    IF NEW.task_id IS NOT NULL THEN
        SELECT room_id INTO v_target_room_id
        FROM public.tasks
        WHERE id = NEW.task_id;

        IF NOT FOUND OR v_target_room_id != NEW.room_id THEN
            RAISE EXCEPTION 'Target task does not belong to the same room.';
        END IF;
    END IF;

    IF NEW.event_id IS NOT NULL THEN
        SELECT room_id INTO v_target_room_id
        FROM public.calendar_events
        WHERE id = NEW.event_id;

        IF NOT FOUND OR v_target_room_id != NEW.room_id THEN
            RAISE EXCEPTION 'Target calendar event does not belong to the same room.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reminders_validate_room
BEFORE INSERT OR UPDATE OF task_id, event_id, room_id ON public.reminders
FOR EACH ROW EXECUTE FUNCTION public.validate_reminder_room();

CREATE TABLE IF NOT EXISTS public.reminder_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id UUID NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL CHECK (char_length(trim(device_id)) >= 1),
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_reminder_user_device UNIQUE (reminder_id, user_id, device_id)
);

COMMENT ON TABLE public.reminder_deliveries IS 'Delivery tracking ensuring idempotent, duplicate-free notifications per device.';

CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_user ON public.reminder_deliveries(user_id);

-- ------------------------------------------------------------------------------
-- 10. Table: activity_logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('room', 'folder', 'note', 'task', 'attachment', 'member', 'board')),
    entity_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'moved', 'restored', 'joined', 'left', 'removed')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.activity_logs IS 'Immutable audit stream of collaborative events within rooms.';

CREATE INDEX IF NOT EXISTS idx_activity_logs_room_time ON public.activity_logs(room_id, created_at DESC);

-- Safe activity logging procedure
CREATE OR REPLACE FUNCTION public.log_room_activity(
    p_room_id UUID,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_action TEXT,
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_log_id UUID;
    v_sanitized_details JSONB;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT public.is_room_member(p_room_id) THEN
        RAISE EXCEPTION 'Unauthorized: Actor is not a member of the room.';
    END IF;

    -- Redact sensitive attributes if inadvertently passed
    v_sanitized_details := p_details - 'token' - 'token_hash' - 'secret' - 'content';

    INSERT INTO public.activity_logs (room_id, actor_id, entity_type, entity_id, action, details)
    VALUES (p_room_id, v_actor_id, p_entity_type, p_entity_id, p_action, v_sanitized_details)
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. Concurrency & Workflow Stored Procedures (RPCs)
-- ------------------------------------------------------------------------------

-- 11.1 update_note_with_version (Optimistic Concurrency Control)
CREATE OR REPLACE FUNCTION public.update_note_with_version(
    p_note_id UUID,
    p_title TEXT,
    p_content JSONB,
    p_folder_id UUID,
    p_expected_version INT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_current_note RECORD;
    v_updated_note RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Lock the row for concurrency inspection
    SELECT * INTO v_current_note
    FROM public.notes
    WHERE id = p_note_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Note not found.');
    END IF;

    IF NOT public.is_room_member(v_current_note.room_id) THEN
        RAISE EXCEPTION 'Unauthorized: User is not a member of this room.';
    END IF;

    -- Conflict detection: reject stale writes
    IF v_current_note.version != p_expected_version THEN
        RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'current_version', v_current_note.version,
            'current_note', row_to_json(v_current_note)
        );
    END IF;

    -- Execute conditional update
    UPDATE public.notes
    SET title = coalesce(p_title, title),
        content = coalesce(p_content, content),
        folder_id = p_folder_id
    WHERE id = p_note_id
    RETURNING * INTO v_updated_note;

    -- Record activity
    PERFORM public.log_room_activity(
        v_updated_note.room_id,
        'note',
        v_updated_note.id,
        'updated',
        jsonb_build_object('title', v_updated_note.title, 'version', v_updated_note.version)
    );

    RETURN jsonb_build_object(
        'success', true,
        'conflict', false,
        'note', row_to_json(v_updated_note)
    );
END;
$$;

-- 11.2 move_task (Atomic Kanban Reordering)
CREATE OR REPLACE FUNCTION public.move_task(
    p_task_id UUID,
    p_column_id UUID,
    p_position INT DEFAULT 0
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_task RECORD;
    v_target_column RECORD;
    v_updated_task RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_task
    FROM public.tasks
    WHERE id = p_task_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task not found.');
    END IF;

    IF NOT public.is_room_member(v_task.room_id) THEN
        RAISE EXCEPTION 'Unauthorized: User is not a member of this room.';
    END IF;

    SELECT * INTO v_target_column
    FROM public.board_columns
    WHERE id = p_column_id;

    IF NOT FOUND OR v_target_column.room_id != v_task.room_id THEN
        RAISE EXCEPTION 'Target column does not belong to the same room.';
    END IF;

    UPDATE public.tasks
    SET column_id = p_column_id,
        position = p_position,
        status = v_target_column.status_key
    WHERE id = p_task_id
    RETURNING * INTO v_updated_task;

    PERFORM public.log_room_activity(
        v_updated_task.room_id,
        'task',
        v_updated_task.id,
        'moved',
        jsonb_build_object(
            'status', v_updated_task.status,
            'column_id', v_updated_task.column_id,
            'position', v_updated_task.position
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'task', row_to_json(v_updated_task)
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. Row Level Security (RLS) Enablement & Policies
-- ------------------------------------------------------------------------------

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_label_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 12.1 Folders Policies
CREATE POLICY "folders_select_members"
ON public.folders FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

CREATE POLICY "folders_insert_members"
ON public.folders FOR INSERT
TO authenticated
WITH CHECK (public.is_room_member(room_id));

CREATE POLICY "folders_update_members"
ON public.folders FOR UPDATE
TO authenticated
USING (public.is_room_member(room_id))
WITH CHECK (public.is_room_member(room_id));

CREATE POLICY "folders_delete_members"
ON public.folders FOR DELETE
TO authenticated
USING (public.is_room_member(room_id));

-- 12.2 Notes Policies
CREATE POLICY "notes_select_members"
ON public.notes FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

CREATE POLICY "notes_insert_members"
ON public.notes FOR INSERT
TO authenticated
WITH CHECK (public.is_room_member(room_id));

CREATE POLICY "notes_update_members"
ON public.notes FOR UPDATE
TO authenticated
USING (public.is_room_member(room_id))
WITH CHECK (public.is_room_member(room_id));

CREATE POLICY "notes_delete_members"
ON public.notes FOR DELETE
TO authenticated
USING (public.is_room_member(room_id));

-- 12.3 Attachments Policies
CREATE POLICY "attachments_select_members"
ON public.attachments FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

CREATE POLICY "attachments_insert_members"
ON public.attachments FOR INSERT
TO authenticated
WITH CHECK (public.is_room_member(room_id));

CREATE POLICY "attachments_delete_members"
ON public.attachments FOR DELETE
TO authenticated
USING (public.is_room_member(room_id));

-- 12.4 Boards Policies
CREATE POLICY "boards_select_members"
ON public.boards FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

CREATE POLICY "boards_modify_members"
ON public.boards FOR ALL
TO authenticated
USING (public.is_room_member(room_id))
WITH CHECK (public.is_room_member(room_id));

-- 12.5 Board Columns Policies
CREATE POLICY "board_columns_select_members"
ON public.board_columns FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

CREATE POLICY "board_columns_modify_members"
ON public.board_columns FOR ALL
TO authenticated
USING (public.is_room_member(room_id))
WITH CHECK (public.is_room_member(room_id));

-- 12.6 Tasks Policies
CREATE POLICY "tasks_select_members"
ON public.tasks FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

CREATE POLICY "tasks_insert_members"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (public.is_room_member(room_id));

CREATE POLICY "tasks_update_members"
ON public.tasks FOR UPDATE
TO authenticated
USING (public.is_room_member(room_id))
WITH CHECK (public.is_room_member(room_id));

CREATE POLICY "tasks_delete_members"
ON public.tasks FOR DELETE
TO authenticated
USING (public.is_room_member(room_id));

-- 12.7 Task Checklists Policies
CREATE POLICY "task_checklists_select_members"
ON public.task_checklists FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

CREATE POLICY "task_checklists_modify_members"
ON public.task_checklists FOR ALL
TO authenticated
USING (public.is_room_member(room_id))
WITH CHECK (public.is_room_member(room_id));

-- 12.8 Task Labels Policies
CREATE POLICY "task_labels_select_members"
ON public.task_labels FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

CREATE POLICY "task_labels_modify_members"
ON public.task_labels FOR ALL
TO authenticated
USING (public.is_room_member(room_id))
WITH CHECK (public.is_room_member(room_id));

-- 12.9 Task Label Assignments Policies
CREATE POLICY "task_label_assignments_select_members"
ON public.task_label_assignments FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

CREATE POLICY "task_label_assignments_modify_members"
ON public.task_label_assignments FOR ALL
TO authenticated
USING (public.is_room_member(room_id))
WITH CHECK (public.is_room_member(room_id));

-- 12.10 Calendar Events Policies
CREATE POLICY "calendar_events_select_members"
ON public.calendar_events FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

CREATE POLICY "calendar_events_modify_members"
ON public.calendar_events FOR ALL
TO authenticated
USING (public.is_room_member(room_id))
WITH CHECK (public.is_room_member(room_id));

-- 12.11 Reminders Policies
CREATE POLICY "reminders_select_members"
ON public.reminders FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

CREATE POLICY "reminders_modify_members"
ON public.reminders FOR ALL
TO authenticated
USING (public.is_room_member(room_id) AND created_by = auth.uid())
WITH CHECK (public.is_room_member(room_id) AND created_by = auth.uid());

-- 12.12 Reminder Deliveries Policies
CREATE POLICY "reminder_deliveries_select_self"
ON public.reminder_deliveries FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "reminder_deliveries_insert_self"
ON public.reminder_deliveries FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 12.13 Activity Logs Policies
CREATE POLICY "activity_logs_select_members"
ON public.activity_logs FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

-- Append-only for members; no client UPDATE or DELETE
CREATE POLICY "activity_logs_insert_members"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_room_member(room_id) AND actor_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 13. Grants & Permissions
-- ------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.log_room_activity(UUID, TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_note_with_version(UUID, TEXT, JSONB, UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.move_task(UUID, UUID, INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.log_room_activity(UUID, TEXT, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_note_with_version(UUID, TEXT, JSONB, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_task(UUID, UUID, INT) TO authenticated;
