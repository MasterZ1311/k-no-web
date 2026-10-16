-- ==============================================================================
-- káno̱ Migration: 20261016230000_fix_invitation_tokens_crypto.sql
-- Description: Fixes 'function gen_random_bytes(integer) does not exist' error
--              by adding 'extensions' schema to function search_path and providing
--              resilient fallbacks for cryptographic random generation and hashing.
-- ==============================================================================

-- Ensure pgcrypto extension is installed in extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------------------------
-- 1. generate_invitation_token (Updated with search_path = public, extensions)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_invitation_token(
    p_room_id UUID,
    p_max_uses INT DEFAULT 1,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_token_plain TEXT;
    v_token_hash TEXT;
    v_token_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT public.is_room_owner(p_room_id) THEN
        RAISE EXCEPTION 'Only the room owner can generate invitation tokens.';
    END IF;

    IF p_max_uses < 1 THEN
        RAISE EXCEPTION 'Maximum uses must be at least 1.';
    END IF;

    IF p_expires_at IS NOT NULL AND p_expires_at <= timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Expiration timestamp must be in the future.';
    END IF;

    -- Generate cryptographically random 48-character hex string (24 bytes)
    BEGIN
        v_token_plain := encode(extensions.gen_random_bytes(24), 'hex');
    EXCEPTION WHEN undefined_function THEN
        BEGIN
            v_token_plain := encode(gen_random_bytes(24), 'hex');
        EXCEPTION WHEN undefined_function THEN
            -- Resilient CSPRNG fallback using core Postgres gen_random_uuid()
            v_token_plain := substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 48);
        END;
    END;

    -- Compute SHA-256 hash for storage
    BEGIN
        v_token_hash := encode(extensions.digest(v_token_plain, 'sha256'), 'hex');
    EXCEPTION WHEN undefined_function THEN
        BEGIN
            v_token_hash := encode(digest(v_token_plain, 'sha256'), 'hex');
        EXCEPTION WHEN undefined_function THEN
            -- Core Postgres sha256 fallback (available in pg_catalog since PG 13)
            v_token_hash := encode(sha256(convert_to(v_token_plain, 'UTF8')), 'hex');
        END;
    END;

    INSERT INTO public.invitation_tokens (
        room_id,
        token_hash,
        created_by,
        max_uses,
        expires_at
    )
    VALUES (
        p_room_id,
        v_token_hash,
        v_user_id,
        p_max_uses,
        p_expires_at
    )
    RETURNING id INTO v_token_id;

    -- Plaintext is returned ONLY to caller at generation time; never stored in plaintext
    RETURN jsonb_build_object(
        'success', true,
        'token', v_token_plain,
        'token_id', v_token_id,
        'room_id', p_room_id,
        'max_uses', p_max_uses,
        'expires_at', p_expires_at
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. redeem_invitation_token (Updated with search_path = public, extensions)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_invitation_token(p_token_plain TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_token_hash TEXT;
    v_token RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_token_plain IS NULL OR char_length(trim(p_token_plain)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Token string is required.');
    END IF;

    BEGIN
        v_token_hash := encode(extensions.digest(trim(p_token_plain), 'sha256'), 'hex');
    EXCEPTION WHEN undefined_function THEN
        BEGIN
            v_token_hash := encode(digest(trim(p_token_plain), 'sha256'), 'hex');
        EXCEPTION WHEN undefined_function THEN
            -- Core Postgres sha256 fallback (available in pg_catalog since PG 13)
            v_token_hash := encode(sha256(convert_to(trim(p_token_plain), 'UTF8')), 'hex');
        END;
    END;

    -- Acquire row-level lock on the token to prevent race conditions exceeding usage limits
    SELECT * INTO v_token
    FROM public.invitation_tokens
    WHERE token_hash = v_token_hash
      AND NOT is_revoked
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or revoked invitation token.');
    END IF;

    IF v_token.expires_at IS NOT NULL AND v_token.expires_at < timezone('utc'::text, now()) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invitation token has expired.');
    END IF;

    IF v_token.uses_count >= v_token.max_uses THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invitation usage limit exceeded.');
    END IF;

    -- Prevent duplicate membership
    IF EXISTS (
        SELECT 1 FROM public.room_members
        WHERE room_id = v_token.room_id AND user_id = v_user_id
    ) THEN
        RETURN jsonb_build_object(
            'success', true,
            'room_id', v_token.room_id,
            'already_member', true,
            'message', 'User is already a member of this room.'
        );
    END IF;

    -- Atomically insert membership
    INSERT INTO public.room_members (room_id, user_id, role, joined_at)
    VALUES (v_token.room_id, v_user_id, 'member', timezone('utc'::text, now()));

    -- Increment usage counter
    UPDATE public.invitation_tokens
    SET uses_count = uses_count + 1
    WHERE id = v_token.id;

    RETURN jsonb_build_object(
        'success', true,
        'room_id', v_token.room_id,
        'already_member', false
    );
END;
$$;

-- Ensure execution permissions
REVOKE ALL ON FUNCTION public.generate_invitation_token(UUID, INT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_invitation_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_invitation_token(UUID, INT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_token(TEXT) TO authenticated;
