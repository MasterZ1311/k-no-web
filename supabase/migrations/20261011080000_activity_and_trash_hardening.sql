-- ==============================================================================
-- Migration: 20261011080000_activity_and_trash_hardening.sql
-- Description: Expand activity_logs check constraints to support calendar_event entities and export actions
-- Traceability: REQ-AUD-01, REQ-EXP-01, Prompt 20
-- ==============================================================================

ALTER TABLE public.activity_logs
    DROP CONSTRAINT IF EXISTS activity_logs_entity_type_check,
    ADD CONSTRAINT activity_logs_entity_type_check
    CHECK (entity_type IN ('room', 'folder', 'note', 'task', 'attachment', 'member', 'board', 'calendar_event'));

ALTER TABLE public.activity_logs
    DROP CONSTRAINT IF EXISTS activity_logs_action_check,
    ADD CONSTRAINT activity_logs_action_check
    CHECK (action IN ('created', 'updated', 'deleted', 'moved', 'restored', 'joined', 'left', 'removed', 'exported'));
