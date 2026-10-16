-- ==============================================================================
-- káno̱ Migration: 20261011055033_initial_auth_and_rooms.sql
-- Description: Database foundation, profile lifecycle, private rooms,
--              memberships, cryptographic invitations, and initial RLS policies.
-- Traceability: REQ-ACC-01, REQ-ACC-02, REQ-ACC-04, REQ-ACC-05, REQ-ACC-06, REQ-ACC-07
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Required Extensions
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 2. Utility Trigger: Automatic Updated At Timestamps
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Table: profiles (Extends auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) >= 1),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users identities.';

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ------------------------------------------------------------------------------
-- 4. Profile Lifecycle Trigger (Auth Synchronization)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_display_name TEXT;
BEGIN
    v_display_name := coalesce(
        NEW.raw_user_meta_data->>'display_name',
        split_part(NEW.email, '@', 1),
        'User'
    );
    IF char_length(trim(v_display_name)) = 0 THEN
        v_display_name := 'User';
    END IF;

    INSERT INTO public.profiles (id, email, display_name, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        v_display_name,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Initializes public.profiles on auth.users registration or email update.';

CREATE OR REPLACE TRIGGER on_auth_user_created
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 5. Table: rooms (Private Collaborative Boundaries)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
    description TEXT,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.rooms IS 'Private collaborative workspaces isolated by Row Level Security.';

CREATE INDEX IF NOT EXISTS idx_rooms_owner_id ON public.rooms(owner_id);

CREATE TRIGGER trg_rooms_updated_at
BEFORE UPDATE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ------------------------------------------------------------------------------
-- 6. Table: room_members (Role-Based Access)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_room_user UNIQUE (room_id, user_id)
);

COMMENT ON TABLE public.room_members IS 'Authenticated user memberships and roles within private rooms.';

CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON public.room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON public.room_members(room_id);

-- ------------------------------------------------------------------------------
-- 7. Automatic Room Owner Membership Trigger
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_room()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.room_members (room_id, user_id, role, joined_at)
    VALUES (NEW.id, NEW.owner_id, 'owner', timezone('utc'::text, now()))
    ON CONFLICT (room_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_room() IS 'Atomically establishes owner membership upon room insertion.';

CREATE OR REPLACE TRIGGER trg_on_room_created
AFTER INSERT ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.handle_new_room();

-- ------------------------------------------------------------------------------
-- 8. Table: invitation_tokens (Cryptographically Hashed Tokens)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitation_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    max_uses INT NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
    uses_count INT NOT NULL DEFAULT 0 CHECK (uses_count <= max_uses),
    expires_at TIMESTAMPTZ,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.invitation_tokens IS 'Revocable room invitation tokens stored as SHA-256 hashes.';

CREATE INDEX IF NOT EXISTS idx_invitation_tokens_room_id ON public.invitation_tokens(room_id);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_hash ON public.invitation_tokens(token_hash);

-- ------------------------------------------------------------------------------
-- 9. Security Definer Helper Functions for RLS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
STABLE
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.room_members
        WHERE room_id = p_room_id
          AND user_id = auth.uid()
    );
END;
$$;

COMMENT ON FUNCTION public.is_room_member(UUID) IS 'Returns true if authenticated caller is a member of the given room.';

CREATE OR REPLACE FUNCTION public.is_room_owner(p_room_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
STABLE
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.rooms
        WHERE id = p_room_id
          AND owner_id = auth.uid()
    );
END;
$$;

COMMENT ON FUNCTION public.is_room_owner(UUID) IS 'Returns true if authenticated caller is the owner of the given room.';

-- ------------------------------------------------------------------------------
-- 10. Privileged Stored Procedures (Security Definer RPCs)
-- ------------------------------------------------------------------------------

-- 10.1 create_room
CREATE OR REPLACE FUNCTION public.create_room(p_name TEXT, p_description TEXT DEFAULT NULL)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_room_id UUID;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF char_length(trim(p_name)) < 1 OR char_length(p_name) > 100 THEN
        RAISE EXCEPTION 'Room name must be between 1 and 100 characters.';
    END IF;

    INSERT INTO public.rooms (name, description, owner_id)
    VALUES (trim(p_name), p_description, v_user_id)
    RETURNING id INTO v_room_id;

    -- Note: trg_on_room_created trigger automatically inserts owner into room_members.

    SELECT jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'description', r.description,
        'owner_id', r.owner_id,
        'role', 'owner',
        'created_at', r.created_at,
        'updated_at', r.updated_at
    ) INTO v_result
    FROM public.rooms r
    WHERE r.id = v_room_id;

    RETURN v_result;
END;
$$;

-- 10.2 generate_invitation_token
CREATE OR REPLACE FUNCTION public.generate_invitation_token(
    p_room_id UUID,
    p_max_uses INT DEFAULT 1,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
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
    v_token_plain := encode(gen_random_bytes(24), 'hex');
    -- Compute SHA-256 hash for storage
    v_token_hash := encode(digest(v_token_plain, 'sha256'), 'hex');

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

-- 10.3 redeem_invitation_token
CREATE OR REPLACE FUNCTION public.redeem_invitation_token(p_token_plain TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
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

    v_token_hash := encode(digest(trim(p_token_plain), 'sha256'), 'hex');

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

-- 10.4 revoke_invitation_token
CREATE OR REPLACE FUNCTION public.revoke_invitation_token(p_token_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_token RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_token
    FROM public.invitation_tokens
    WHERE id = p_token_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invitation token not found.');
    END IF;

    IF NOT public.is_room_owner(v_token.room_id) THEN
        RAISE EXCEPTION 'Only the room owner can revoke invitation tokens.';
    END IF;

    UPDATE public.invitation_tokens
    SET is_revoked = true
    WHERE id = p_token_id;

    RETURN jsonb_build_object('success', true, 'token_id', p_token_id);
END;
$$;

-- 10.5 remove_room_member
CREATE OR REPLACE FUNCTION public.remove_room_member(p_room_id UUID, p_target_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_owner BOOLEAN;
    v_target_role TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    v_is_owner := public.is_room_owner(p_room_id);

    -- Caller must be owner, OR caller must be removing themselves (leaving room)
    IF NOT v_is_owner AND v_caller_id != p_target_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the room owner can evict members.';
    END IF;

    SELECT role INTO v_target_role
    FROM public.room_members
    WHERE room_id = p_room_id AND user_id = p_target_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Member not found in room.');
    END IF;

    -- Owner cannot be removed directly; must transfer ownership or delete room
    IF v_target_role = 'owner' THEN
        RAISE EXCEPTION 'Room owner cannot be removed. Transfer ownership or delete the room.';
    END IF;

    DELETE FROM public.room_members
    WHERE room_id = p_room_id AND user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'room_id', p_room_id, 'user_id', p_target_user_id);
END;
$$;

-- 10.6 transfer_room_ownership
CREATE OR REPLACE FUNCTION public.transfer_room_ownership(p_room_id UUID, p_new_owner_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT public.is_room_owner(p_room_id) THEN
        RAISE EXCEPTION 'Only the current room owner can transfer ownership.';
    END IF;

    IF v_caller_id = p_new_owner_id THEN
        RAISE EXCEPTION 'Cannot transfer ownership to yourself.';
    END IF;

    -- New owner must already be an active room member
    IF NOT EXISTS (
        SELECT 1 FROM public.room_members
        WHERE room_id = p_room_id AND user_id = p_new_owner_id
    ) THEN
        RAISE EXCEPTION 'New owner must be an existing member of the room.';
    END IF;

    -- Atomically swap owner in rooms table
    UPDATE public.rooms
    SET owner_id = p_new_owner_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_room_id;

    -- Promote new owner
    UPDATE public.room_members
    SET role = 'owner'
    WHERE room_id = p_room_id AND user_id = p_new_owner_id;

    -- Demote previous owner to standard member
    UPDATE public.room_members
    SET role = 'member'
    WHERE room_id = p_room_id AND user_id = v_caller_id;

    RETURN jsonb_build_object(
        'success', true,
        'room_id', p_room_id,
        'previous_owner_id', v_caller_id,
        'new_owner_id', p_new_owner_id
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. Row Level Security (RLS) Enablement & Policies
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;

-- 11.1 Policies for profiles
CREATE POLICY "profiles_select_self_or_comember"
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.room_members rm1
        JOIN public.room_members rm2 ON rm1.room_id = rm2.room_id
        WHERE rm1.user_id = profiles.id
          AND rm2.user_id = auth.uid()
    )
);

CREATE POLICY "profiles_update_self"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 11.2 Policies for rooms
CREATE POLICY "rooms_select_members"
ON public.rooms FOR SELECT
TO authenticated
USING (public.is_room_member(id));

CREATE POLICY "rooms_insert_owner"
ON public.rooms FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "rooms_update_owner"
ON public.rooms FOR UPDATE
TO authenticated
USING (public.is_room_owner(id))
WITH CHECK (public.is_room_owner(id));

CREATE POLICY "rooms_delete_owner"
ON public.rooms FOR DELETE
TO authenticated
USING (public.is_room_owner(id));

-- 11.3 Policies for room_members
CREATE POLICY "room_members_select"
ON public.room_members FOR SELECT
TO authenticated
USING (public.is_room_member(room_id));

CREATE POLICY "room_members_delete_authorized"
ON public.room_members FOR DELETE
TO authenticated
USING (
    (public.is_room_owner(room_id) AND role != 'owner')
    OR (user_id = auth.uid() AND role != 'owner')
);

-- 11.4 Policies for invitation_tokens
CREATE POLICY "invitation_tokens_owner_all"
ON public.invitation_tokens FOR ALL
TO authenticated
USING (public.is_room_owner(room_id))
WITH CHECK (public.is_room_owner(room_id));

-- ------------------------------------------------------------------------------
-- 12. Explicit Permissions & Execution Grants
-- ------------------------------------------------------------------------------

-- Revoke default public execution privileges
REVOKE ALL ON FUNCTION public.is_room_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_room_owner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_room(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_invitation_token(UUID, INT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_invitation_token(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_invitation_token(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_room_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_room_ownership(UUID, UUID) FROM PUBLIC;

-- Grant execution to authenticated role only
GRANT EXECUTE ON FUNCTION public.is_room_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_room_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_room(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invitation_token(UUID, INT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invitation_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_room_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_room_ownership(UUID, UUID) TO authenticated;
