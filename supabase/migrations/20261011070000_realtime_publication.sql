-- ==============================================================================
-- Migration: 20261011070000_realtime_publication.sql
-- Subsystem: Realtime Collaboration (REQ-COL-01, AC-COL-01)
-- Description: Configures supabase_realtime publication and REPLICA IDENTITY FULL
--              for room-scoped collaborative entities.
-- ==============================================================================

DO $$
BEGIN
  -- Ensure publication exists
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$$;

DO $$
DECLARE
  tbl text;
  publication_tables text[] := ARRAY[
    'notes',
    'folders',
    'tasks',
    'task_checklists',
    'task_labels',
    'task_label_assignments',
    'boards',
    'board_columns',
    'calendar_events',
    'room_members',
    'activity_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY publication_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      -- Set replica identity to full so update and delete events carry complete context
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', tbl);

      -- Add table to publication if not already added
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
      END IF;
    END IF;
  END LOOP;
END;
$$;
