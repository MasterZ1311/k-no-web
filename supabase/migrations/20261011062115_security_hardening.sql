-- ==============================================================================
-- káno̱ Migration: 20261011062115_security_hardening.sql
-- Description: Security audit fixes: Storage bucket policies on storage.objects,
--              cross-room transfer immutability triggers, server metadata protection,
--              activity log tamper prevention, reminder occurrence deduplication,
--              and table grant hardening.
-- Traceability: NFR-SEC-01, NFR-SEC-02, NFR-SEC-03, REQ-ACC-07, REQ-OFF-05
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Storage Configuration & RLS Policies (room-attachments)
-- ------------------------------------------------------------------------------

-- Ensure room-attachments bucket is registered in storage.buckets with private settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'room-attachments',
    'room-attachments',
    false,
    26214400, -- 25MB max per contract
    ARRAY[
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'application/pdf',
        'text/plain',
        'text/markdown'
    ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'application/pdf',
        'text/plain',
        'text/markdown'
    ];

-- Helper function to extract room_id safely from standard storage path
-- Format: rooms/<room_id>/<attachment_id>/<filename>
CREATE OR REPLACE FUNCTION public.storage_extract_room_id(p_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT (regexp_match(p_name, '^rooms/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'))[1]::uuid;
$$;

COMMENT ON FUNCTION public.storage_extract_room_id(TEXT) IS 'Extracts UUID room_id from storage path rooms/<room_id>/...';

-- Storage RLS Policies on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "storage_room_attachments_select" ON storage.objects;
CREATE POLICY "storage_room_attachments_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'room-attachments'
    AND public.is_room_member(public.storage_extract_room_id(name))
);

DROP POLICY IF EXISTS "storage_room_attachments_insert" ON storage.objects;
CREATE POLICY "storage_room_attachments_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'room-attachments'
    AND public.is_room_member(public.storage_extract_room_id(name))
);

DROP POLICY IF EXISTS "storage_room_attachments_delete" ON storage.objects;
CREATE POLICY "storage_room_attachments_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'room-attachments'
    AND public.is_room_member(public.storage_extract_room_id(name))
);

-- ------------------------------------------------------------------------------
-- 2. Immutable Room Boundary Trigger (Prevent Cross-Room Move of Existing Entities)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_cross_room_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.room_id IS DISTINCT FROM OLD.room_id THEN
        RAISE EXCEPTION 'Security violation: Transferring entities across room boundaries is prohibited.';
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_cross_room_transfer() IS 'Prevents unauthorized cross-room entity relocation on updates.';

CREATE TRIGGER trg_folders_prevent_room_transfer
BEFORE UPDATE OF room_id ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.prevent_cross_room_transfer();

CREATE TRIGGER trg_notes_prevent_room_transfer
BEFORE UPDATE OF room_id ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.prevent_cross_room_transfer();

CREATE TRIGGER trg_attachments_prevent_room_transfer
BEFORE UPDATE OF room_id ON public.attachments
FOR EACH ROW EXECUTE FUNCTION public.prevent_cross_room_transfer();

CREATE TRIGGER trg_boards_prevent_room_transfer
BEFORE UPDATE OF room_id ON public.boards
FOR EACH ROW EXECUTE FUNCTION public.prevent_cross_room_transfer();

CREATE TRIGGER trg_board_columns_prevent_room_transfer
BEFORE UPDATE OF room_id ON public.board_columns
FOR EACH ROW EXECUTE FUNCTION public.prevent_cross_room_transfer();

CREATE TRIGGER trg_tasks_prevent_room_transfer
BEFORE UPDATE OF room_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.prevent_cross_room_transfer();

CREATE TRIGGER trg_task_checklists_prevent_room_transfer
BEFORE UPDATE OF room_id ON public.task_checklists
FOR EACH ROW EXECUTE FUNCTION public.prevent_cross_room_transfer();

CREATE TRIGGER trg_task_labels_prevent_room_transfer
BEFORE UPDATE OF room_id ON public.task_labels
FOR EACH ROW EXECUTE FUNCTION public.prevent_cross_room_transfer();

CREATE TRIGGER trg_calendar_events_prevent_room_transfer
BEFORE UPDATE OF room_id ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_cross_room_transfer();

CREATE TRIGGER trg_reminders_prevent_room_transfer
BEFORE UPDATE OF room_id ON public.reminders
FOR EACH ROW EXECUTE FUNCTION public.prevent_cross_room_transfer();

-- ------------------------------------------------------------------------------
-- 3. Protection of Server-Controlled Creation Metadata
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_server_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_server_metadata() IS 'Preserves original creation timestamp and author metadata across updates.';

CREATE TRIGGER trg_folders_protect_metadata
BEFORE UPDATE OF created_at, created_by ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.protect_server_metadata();

CREATE TRIGGER trg_notes_protect_metadata
BEFORE UPDATE OF created_at, created_by ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.protect_server_metadata();

CREATE TRIGGER trg_tasks_protect_metadata
BEFORE UPDATE OF created_at, created_by ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.protect_server_metadata();

CREATE TRIGGER trg_calendar_events_protect_metadata
BEFORE UPDATE OF created_at, created_by ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.protect_server_metadata();

-- ------------------------------------------------------------------------------
-- 4. Activity Log Tamper Prevention
-- ------------------------------------------------------------------------------

-- Direct INSERT by clients on activity_logs is removed to prevent forged audit entries
DROP POLICY IF EXISTS "activity_logs_insert_members" ON public.activity_logs;

-- Activity logs are strictly append-only through the SECURITY DEFINER function log_room_activity
REVOKE INSERT, UPDATE, DELETE ON public.activity_logs FROM anon, authenticated;
GRANT SELECT ON public.activity_logs TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. Reminder Delivery Deduplication per Scheduled Occurrence
-- ------------------------------------------------------------------------------

-- Add scheduled_for column to allow tracking distinct scheduled occurrences of reminders
ALTER TABLE public.reminder_deliveries
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- Drop old single-delivery constraint and apply occurrence-aware deduplication
ALTER TABLE public.reminder_deliveries
DROP CONSTRAINT IF EXISTS unique_reminder_user_device;

ALTER TABLE public.reminder_deliveries
ADD CONSTRAINT unique_reminder_delivery_occurrence UNIQUE (reminder_id, user_id, device_id, scheduled_for);

-- ------------------------------------------------------------------------------
-- 6. Board & Column Governance (Owner-Restricted Column Management)
-- ------------------------------------------------------------------------------

-- Ordinary members should not delete or alter Kanban columns
DROP POLICY IF EXISTS "board_columns_modify_members" ON public.board_columns;
DROP POLICY IF EXISTS "boards_modify_members" ON public.boards;

-- Boards modification restricted to room owner
CREATE POLICY "boards_modify_owner"
ON public.boards FOR ALL
TO authenticated
USING (public.is_room_owner(room_id))
WITH CHECK (public.is_room_owner(room_id));

-- Column insert/update/delete restricted to room owner
CREATE POLICY "board_columns_insert_owner"
ON public.board_columns FOR INSERT
TO authenticated
WITH CHECK (public.is_room_owner(room_id));

CREATE POLICY "board_columns_update_owner"
ON public.board_columns FOR UPDATE
TO authenticated
USING (public.is_room_owner(room_id))
WITH CHECK (public.is_room_owner(room_id));

CREATE POLICY "board_columns_delete_owner"
ON public.board_columns FOR DELETE
TO authenticated
USING (public.is_room_owner(room_id));

-- ------------------------------------------------------------------------------
-- 7. Hardened UPDATE Policies with Explicit WITH CHECK Validation
-- ------------------------------------------------------------------------------

-- Notes UPDATE policy with folder room verification
DROP POLICY IF EXISTS "notes_update_members" ON public.notes;
CREATE POLICY "notes_update_members"
ON public.notes FOR UPDATE
TO authenticated
USING (public.is_room_member(room_id))
WITH CHECK (
    public.is_room_member(room_id)
    AND (folder_id IS NULL OR EXISTS (SELECT 1 FROM public.folders f WHERE f.id = folder_id AND f.room_id = room_id))
);

-- Tasks UPDATE policy with column room verification
DROP POLICY IF EXISTS "tasks_update_members" ON public.tasks;
CREATE POLICY "tasks_update_members"
ON public.tasks FOR UPDATE
TO authenticated
USING (public.is_room_member(room_id))
WITH CHECK (
    public.is_room_member(room_id)
    AND EXISTS (SELECT 1 FROM public.board_columns c WHERE c.id = column_id AND c.room_id = room_id)
);

-- ------------------------------------------------------------------------------
-- 8. Table Privilege Hardening (Least Privilege Grants)
-- ------------------------------------------------------------------------------

-- Revoke write privileges from anon on all public tables
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;

-- Ensure authenticated role has necessary table privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
-- Re-enforce read-only for activity_logs and invitation_tokens (managed via RPCs)
REVOKE INSERT, UPDATE, DELETE ON public.activity_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invitation_tokens FROM authenticated;
