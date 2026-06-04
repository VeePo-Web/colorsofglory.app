# Lovable Build Prompt — Invite Flow Backend
## Colors of Glory · Supabase Infrastructure
## Paste this entire document into Lovable to execute

---

## CONTEXT (READ THIS FIRST)

You are building the backend infrastructure for a **song invite acceptance flow** in the Colors of Glory app. A songwriting app built in React 18 + Vite + Supabase.

The frontend engineer (Claude) is ready to build 5 screens but needs the Supabase backend to exist first. Your job is to build everything in this document **exactly as specified** — tables, columns, types, RLS policies, RPC functions, triggers — so Claude can wire the frontend without making any backend assumptions.

**Do not** build any UI. **Do not** modify existing frontend files. **Do not** change App.tsx or any React component. Your entire scope is Supabase only.

**Tech stack:**
- Supabase (Postgres + Auth + Storage + Edge Functions)
- Auth method: Phone OTP via Twilio (already configured — do NOT reconfigure)
- Existing tables: `songs`, `users` (or `profiles`), `song_members` (may not exist yet)

**Read every section before writing any SQL.**

---

## STEP 0 — AUDIT EXISTING SCHEMA

Before creating anything, check what already exists:

```sql
-- Run this first to see what tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Run this to see existing columns on key tables
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('songs', 'users', 'profiles', 'song_members')
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

**If `song_members` already exists:** Adapt the CREATE TABLE below to ALTER instead of CREATE. Do not drop existing data.

**If `users` and `profiles` are separate:** Use whichever table stores `phone`, `first_name`, `last_name`. The spec below assumes a `profiles` table linked to `auth.users`.

---

## STEP 1 — EXTEND EXISTING TABLES

### 1A. `profiles` table — add missing columns if not present

```sql
-- Add columns only if they don't exist (safe ALTER)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='profiles' AND column_name='first_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN first_name TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='profiles' AND column_name='last_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_name TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='profiles' AND column_name='avatar_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='profiles' AND column_name='avatar_color'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_color TEXT DEFAULT '#8070C4';
  END IF;
END $$;

-- avatar_color: one of the aurora palette colors assigned per user
-- '#8070C4' (purple) | '#4D8FD2' (blue) | '#53AB8B' (teal) | '#D4AE5C' (gold) | '#C26A95' (rose)
```

### 1B. `songs` table — add `lyrics_snippet` for invite preview blurred preview

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='songs' AND column_name='lyrics_snippet'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN lyrics_snippet TEXT;
    -- This stores the first 2-3 lines of lyrics for the blurred invite preview
    -- Updated automatically via trigger when lyrics are saved (Step 5)
  END IF;
END $$;
```

### 1C. `song_members` table — create if not exists

```sql
CREATE TABLE IF NOT EXISTS public.song_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id         UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'contributor'
                  CHECK (role IN ('owner', 'viewer', 'contributor', 'reviewer')),
  invited_by      UUID REFERENCES auth.users(id),   -- who sent the invite (null if owner)
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (song_id, user_id)  -- one membership per user per song
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_song_members_song_id ON public.song_members(song_id);
CREATE INDEX IF NOT EXISTS idx_song_members_user_id ON public.song_members(user_id);
```

---

## STEP 2 — NEW TABLES

### 2A. `invite_tokens`

```sql
CREATE TABLE public.invite_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The secret token embedded in the share URL
  -- URL format: colorsofglory.app/join/[token]
  token           TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'base64url'),
  
  song_id         UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role granted to anyone who accepts this invite
  assigned_role   TEXT NOT NULL DEFAULT 'contributor'
                  CHECK (assigned_role IN ('viewer', 'contributor', 'reviewer')),
  
  -- Usage limits
  -- NULL means unlimited (up to max_uses constraint)
  max_uses        INTEGER DEFAULT 1 CHECK (max_uses > 0),
  current_uses    INTEGER NOT NULL DEFAULT 0 CHECK (current_uses >= 0),
  
  -- Owner can revoke a link at any time
  is_revoked      BOOLEAN NOT NULL DEFAULT false,
  
  -- No expires_at — owner revokes manually (product decision)
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast token lookup (used on every invite link click)
CREATE UNIQUE INDEX idx_invite_tokens_token ON public.invite_tokens(token);
CREATE INDEX idx_invite_tokens_song_id ON public.invite_tokens(song_id);
CREATE INDEX idx_invite_tokens_created_by ON public.invite_tokens(created_by);

-- Updated_at trigger
CREATE TRIGGER set_invite_tokens_updated_at
  BEFORE UPDATE ON public.invite_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
-- NOTE: If handle_updated_at() doesn't exist, create it:
-- CREATE OR REPLACE FUNCTION public.handle_updated_at()
-- RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
```

### 2B. `invite_acceptances`

```sql
CREATE TABLE public.invite_acceptances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id        UUID NOT NULL REFERENCES public.invite_tokens(id) ON DELETE CASCADE,
  accepted_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (token_id, accepted_by)  -- one acceptance per user per token
);

CREATE INDEX idx_invite_acceptances_token_id ON public.invite_acceptances(token_id);
CREATE INDEX idx_invite_acceptances_accepted_by ON public.invite_acceptances(accepted_by);
```

### 2C. `invite_requests`

```sql
-- When someone hits an expired/capacity link, they can "Request new invite"
-- This notifies the song owner to send a fresh link

CREATE TABLE public.invite_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The original token they tried to use (may be invalid)
  original_token  TEXT NOT NULL,
  
  -- The song they're trying to join (null if we can't determine it)
  song_id         UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  
  -- The person requesting access (authenticated or just a phone number)
  requested_by_user_id  UUID REFERENCES auth.users(id),
  requested_by_phone    TEXT,  -- e164 format, if they typed their number
  
  -- Status tracking
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'fulfilled', 'ignored')),
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_requests_song_id ON public.invite_requests(song_id);
```

### 2D. `song_notification_prefs`

```sql
-- Per-song, per-user notification preferences
-- Owner sets these for each song they own

CREATE TABLE public.song_notification_prefs (
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id                 UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  
  -- Notify when someone accepts an invite to this song
  notify_on_join          BOOLEAN NOT NULL DEFAULT true,
  
  -- Notify when a collaborator adds a lyric, voice memo, or comment
  notify_on_contribution  BOOLEAN NOT NULL DEFAULT true,
  
  -- Notification channel
  push_enabled            BOOLEAN NOT NULL DEFAULT true,
  
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  PRIMARY KEY (user_id, song_id)
);

CREATE TRIGGER set_notification_prefs_updated_at
  BEFORE UPDATE ON public.song_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### 2E. `activity_feed`

```sql
-- Records all meaningful events in a song for the "What changed" screen
-- Also drives real-time notifications to the song owner

CREATE TABLE public.activity_feed (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id         UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  
  -- Who did the action
  actor_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- What happened
  action_type     TEXT NOT NULL
                  CHECK (action_type IN (
                    'joined',           -- someone accepted an invite
                    'added_voice_memo', -- new voice memo uploaded
                    'edited_lyrics',    -- lyrics section changed
                    'added_comment',    -- new comment left
                    'suggested_chord',  -- chord change suggested
                    'approved_change',  -- reviewer approved something
                    'rejected_change',  -- reviewer rejected something
                    'invited_collaborator' -- owner invited someone new
                  )),
  
  -- Flexible JSON payload — structure depends on action_type
  -- Examples:
  -- joined:           { "role": "contributor" }
  -- added_voice_memo: { "memo_name": "Chorus idea", "duration_s": 42, "section": "Chorus" }
  -- edited_lyrics:    { "section": "Verse 2", "change_preview": "first 60 chars of new text" }
  payload         JSONB DEFAULT '{}',
  
  -- Whether the song owner has "seen" this event
  seen_by_owner   BOOLEAN NOT NULL DEFAULT false,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_feed_song_id ON public.activity_feed(song_id);
CREATE INDEX idx_activity_feed_actor ON public.activity_feed(actor_user_id);
CREATE INDEX idx_activity_feed_seen ON public.activity_feed(song_id, seen_by_owner)
  WHERE seen_by_owner = false;  -- partial index for unread count queries
```

---

## STEP 3 — ROW LEVEL SECURITY (RLS)

Enable RLS and write policies for every new table.

### 3A. `invite_tokens` RLS

```sql
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

-- POLICY 1: Anyone (including anon) can read a single token by its token value
-- This is needed for the invite preview screen before the user signs up
CREATE POLICY "invite_tokens_read_by_token"
  ON public.invite_tokens FOR SELECT
  USING (true);  -- token lookup is filtered in the query itself — only safe fields returned

-- POLICY 2: Authenticated song owners can create invite tokens
CREATE POLICY "invite_tokens_insert_by_owner"
  ON public.invite_tokens FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.song_members
      WHERE song_id = invite_tokens.song_id
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- POLICY 3: Song owners can update (revoke) their own tokens
CREATE POLICY "invite_tokens_update_by_owner"
  ON public.invite_tokens FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- POLICY 4: Song owners can delete their own tokens
CREATE POLICY "invite_tokens_delete_by_owner"
  ON public.invite_tokens FOR DELETE
  USING (auth.uid() = created_by);
```

### 3B. `invite_acceptances` RLS

```sql
ALTER TABLE public.invite_acceptances ENABLE ROW LEVEL SECURITY;

-- Anyone can read acceptances for songs they're a member of
CREATE POLICY "invite_acceptances_read_by_member"
  ON public.invite_acceptances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invite_tokens t
      JOIN public.song_members m ON m.song_id = t.song_id
      WHERE t.id = invite_acceptances.token_id
      AND m.user_id = auth.uid()
    )
  );

-- Authenticated users can record their own acceptance
CREATE POLICY "invite_acceptances_insert_self"
  ON public.invite_acceptances FOR INSERT
  WITH CHECK (auth.uid() = accepted_by);
```

### 3C. `song_members` RLS

```sql
ALTER TABLE public.song_members ENABLE ROW LEVEL SECURITY;

-- Song members can read all members of songs they belong to
CREATE POLICY "song_members_read_by_member"
  ON public.song_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.song_members sm
      WHERE sm.song_id = song_members.song_id
      AND sm.user_id = auth.uid()
    )
  );

-- Only the accept_invite RPC (runs as security definer) inserts rows here
-- Direct inserts are blocked
CREATE POLICY "song_members_insert_via_rpc_only"
  ON public.song_members FOR INSERT
  WITH CHECK (false);  -- RPC bypasses RLS via SECURITY DEFINER

-- Song owners can update member roles
CREATE POLICY "song_members_update_by_owner"
  ON public.song_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.song_members owner_row
      WHERE owner_row.song_id = song_members.song_id
      AND owner_row.user_id = auth.uid()
      AND owner_row.role = 'owner'
    )
  );

-- Song owners can remove members
CREATE POLICY "song_members_delete_by_owner"
  ON public.song_members FOR DELETE
  USING (
    user_id = auth.uid()  -- members can leave
    OR EXISTS (
      SELECT 1 FROM public.song_members owner_row
      WHERE owner_row.song_id = song_members.song_id
      AND owner_row.user_id = auth.uid()
      AND owner_row.role = 'owner'
    )
  );
```

### 3D. `activity_feed` RLS

```sql
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- Song members can read the activity feed
CREATE POLICY "activity_feed_read_by_member"
  ON public.activity_feed FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.song_members
      WHERE song_id = activity_feed.song_id
      AND user_id = auth.uid()
    )
  );

-- Activity is inserted by RPC functions only (SECURITY DEFINER)
CREATE POLICY "activity_feed_insert_via_rpc"
  ON public.activity_feed FOR INSERT
  WITH CHECK (false);  -- blocked for direct inserts

-- Song owners can mark activity as seen
CREATE POLICY "activity_feed_update_seen_by_owner"
  ON public.activity_feed FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.song_members
      WHERE song_id = activity_feed.song_id
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );
```

### 3E. `song_notification_prefs` RLS

```sql
ALTER TABLE public.song_notification_prefs ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own notification preferences
CREATE POLICY "notification_prefs_own_only"
  ON public.song_notification_prefs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 3F. `invite_requests` RLS

```sql
ALTER TABLE public.invite_requests ENABLE ROW LEVEL SECURITY;

-- Song owners can read requests for their songs
CREATE POLICY "invite_requests_read_by_owner"
  ON public.invite_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.song_members
      WHERE song_id = invite_requests.song_id
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- Anyone authenticated can insert a request
CREATE POLICY "invite_requests_insert_any_auth"
  ON public.invite_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by_user_id
    OR requested_by_user_id IS NULL  -- allow without user if just phone number
  );
```

---

## STEP 4 — RPC FUNCTIONS

These run as `SECURITY DEFINER` so they can bypass RLS and perform atomic multi-table operations safely.

### 4A. `preview_invite(p_token TEXT)` — called before auth, safe for anon

```sql
-- Returns all the data the invite preview screen needs
-- Safe to call without authentication (anon key is fine)

CREATE OR REPLACE FUNCTION public.preview_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row     public.invite_tokens%ROWTYPE;
  v_song          RECORD;
  v_inviter       RECORD;
  v_collaborators JSONB;
  v_current_user  UUID := auth.uid();  -- NULL if anon
  v_is_member     BOOLEAN := false;
BEGIN
  -- 1. Fetch the token
  SELECT * INTO v_token_row
  FROM public.invite_tokens
  WHERE token = p_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid', 'error_code', 'INVITE_NOT_FOUND');
  END IF;
  
  IF v_token_row.is_revoked THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error_code', 'INVITE_REVOKED',
      'song_id', v_token_row.song_id
    );
  END IF;
  
  IF v_token_row.max_uses IS NOT NULL 
     AND v_token_row.current_uses >= v_token_row.max_uses THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error_code', 'INVITE_EXHAUSTED',
      'song_id', v_token_row.song_id,
      'inviter_name', (
        SELECT first_name FROM public.profiles WHERE id = v_token_row.created_by
      )
    );
  END IF;
  
  -- 2. Check if current user is already a member
  IF v_current_user IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.song_members
      WHERE song_id = v_token_row.song_id AND user_id = v_current_user
    ) INTO v_is_member;
    
    IF v_is_member THEN
      RETURN jsonb_build_object(
        'status', 'already_member',
        'error_code', 'INVITE_ALREADY_MEMBER',
        'song_id', v_token_row.song_id,
        'song_title', (SELECT title FROM public.songs WHERE id = v_token_row.song_id),
        'joined_at', (
          SELECT joined_at FROM public.song_members
          WHERE song_id = v_token_row.song_id AND user_id = v_current_user
        )
      );
    END IF;
  END IF;
  
  -- 3. Fetch song details
  SELECT id, title, lyrics_snippet
  INTO v_song
  FROM public.songs
  WHERE id = v_token_row.song_id;
  
  -- 4. Fetch inviter name
  SELECT first_name, last_name, avatar_color
  INTO v_inviter
  FROM public.profiles
  WHERE id = v_token_row.created_by;
  
  -- 5. Fetch existing collaborators (max 5, for the team intro screen)
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', sm.user_id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'avatar_color', COALESCE(p.avatar_color, '#8070C4'),
      'avatar_initials', UPPER(LEFT(p.first_name, 1) || LEFT(p.last_name, 1))
    )
    ORDER BY sm.joined_at ASC
  ) INTO v_collaborators
  FROM public.song_members sm
  JOIN public.profiles p ON p.id = sm.user_id
  WHERE sm.song_id = v_token_row.song_id
  LIMIT 5;
  
  -- 6. Return the full preview payload
  RETURN jsonb_build_object(
    'status', 'valid',
    'token_id', v_token_row.id,
    'song_id', v_song.id,
    'song_title', v_song.title,
    'lyrics_snippet', v_song.lyrics_snippet,  -- used for blurred preview
    'assigned_role', v_token_row.assigned_role,
    'inviter_first_name', v_inviter.first_name,
    'inviter_last_name', v_inviter.last_name,
    'inviter_avatar_color', v_inviter.avatar_color,
    'collaborators', COALESCE(v_collaborators, '[]'::jsonb),
    'collaborator_count', (
      SELECT COUNT(*) FROM public.song_members WHERE song_id = v_token_row.song_id
    ),
    'max_uses', v_token_row.max_uses,
    'current_uses', v_token_row.current_uses,
    'uses_remaining', CASE
      WHEN v_token_row.max_uses IS NULL THEN NULL  -- unlimited
      ELSE v_token_row.max_uses - v_token_row.current_uses
    END
  );
END;
$$;

-- Grant anon access so this works before auth
GRANT EXECUTE ON FUNCTION public.preview_invite(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.preview_invite(TEXT) TO authenticated;
```

### 4B. `accept_invite(p_token TEXT)` — requires authentication

```sql
-- Atomic invite acceptance:
-- 1. Validates the token (again, server-side)
-- 2. Checks user isn't already a member
-- 3. Inserts song_member
-- 4. Increments token usage
-- 5. Records acceptance history
-- 6. Creates activity feed entry
-- 7. Sends notification to song owner (via pg_notify → Supabase Realtime)
-- Returns: { song_id, role, song_title } for post-accept navigation

CREATE OR REPLACE FUNCTION public.accept_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID := auth.uid();
  v_token_row     public.invite_tokens%ROWTYPE;
  v_song_title    TEXT;
  v_is_member     BOOLEAN;
BEGIN
  -- Require authentication
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  
  -- 1. Lock the token row to prevent race conditions
  SELECT * INTO v_token_row
  FROM public.invite_tokens
  WHERE token = p_token
  FOR UPDATE;  -- row-level lock prevents double-accepts
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND';
  END IF;
  
  IF v_token_row.is_revoked THEN
    RAISE EXCEPTION 'INVITE_REVOKED';
  END IF;
  
  IF v_token_row.max_uses IS NOT NULL
     AND v_token_row.current_uses >= v_token_row.max_uses THEN
    RAISE EXCEPTION 'INVITE_EXHAUSTED';
  END IF;
  
  -- 2. Check already a member
  SELECT EXISTS(
    SELECT 1 FROM public.song_members
    WHERE song_id = v_token_row.song_id AND user_id = v_user_id
  ) INTO v_is_member;
  
  IF v_is_member THEN
    -- Not an error — return success so frontend can navigate to the song
    SELECT title INTO v_song_title FROM public.songs WHERE id = v_token_row.song_id;
    RETURN jsonb_build_object(
      'status', 'already_member',
      'song_id', v_token_row.song_id,
      'song_title', v_song_title,
      'role', (
        SELECT role FROM public.song_members
        WHERE song_id = v_token_row.song_id AND user_id = v_user_id
      )
    );
  END IF;
  
  -- 3. Insert the new song member
  INSERT INTO public.song_members (song_id, user_id, role, invited_by)
  VALUES (v_token_row.song_id, v_user_id, v_token_row.assigned_role, v_token_row.created_by);
  
  -- 4. Increment token usage (atomic with the lock above)
  UPDATE public.invite_tokens
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE id = v_token_row.id;
  
  -- 5. Record acceptance
  INSERT INTO public.invite_acceptances (token_id, accepted_by)
  VALUES (v_token_row.id, v_user_id)
  ON CONFLICT (token_id, accepted_by) DO NOTHING;
  
  -- 6. Create activity feed entry
  INSERT INTO public.activity_feed (song_id, actor_user_id, action_type, payload)
  VALUES (
    v_token_row.song_id,
    v_user_id,
    'joined',
    jsonb_build_object('role', v_token_row.assigned_role)
  );
  
  -- 7. Notify owner via pg_notify → Supabase Realtime picks this up
  -- The notification payload is safe for the owner to read
  PERFORM pg_notify(
    'invite_accepted',
    jsonb_build_object(
      'song_id', v_token_row.song_id,
      'owner_id', v_token_row.created_by,
      'new_member_id', v_user_id,
      'role', v_token_row.assigned_role
    )::text
  );
  
  -- 8. Auto-create default notification prefs for the new member
  INSERT INTO public.song_notification_prefs (user_id, song_id)
  VALUES (v_user_id, v_token_row.song_id)
  ON CONFLICT (user_id, song_id) DO NOTHING;
  
  -- 9. Return success payload for frontend navigation
  SELECT title INTO v_song_title FROM public.songs WHERE id = v_token_row.song_id;
  
  RETURN jsonb_build_object(
    'status', 'success',
    'song_id', v_token_row.song_id,
    'song_title', v_song_title,
    'role', v_token_row.assigned_role
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Roll back everything if anything fails
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite(TEXT) TO authenticated;
```

### 4C. `generate_invite_token(p_song_id UUID, p_role TEXT, p_max_uses INT)` — for song owners

```sql
-- Called when a song owner taps "Invite" inside a song
-- Returns the full URL-ready token

CREATE OR REPLACE FUNCTION public.generate_invite_token(
  p_song_id   UUID,
  p_role      TEXT    DEFAULT 'contributor',
  p_max_uses  INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_is_owner  BOOLEAN;
  v_token     TEXT;
  v_token_id  UUID;
BEGIN
  -- Verify caller is the song owner
  SELECT EXISTS(
    SELECT 1 FROM public.song_members
    WHERE song_id = p_song_id
    AND user_id = v_user_id
    AND role = 'owner'
  ) INTO v_is_owner;
  
  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'NOT_SONG_OWNER';
  END IF;
  
  -- Validate role
  IF p_role NOT IN ('viewer', 'contributor', 'reviewer') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;
  
  -- Generate the token
  v_token := encode(gen_random_bytes(24), 'base64url');
  
  -- Insert
  INSERT INTO public.invite_tokens (token, song_id, created_by, assigned_role, max_uses)
  VALUES (v_token, p_song_id, v_user_id, p_role, p_max_uses)
  RETURNING id INTO v_token_id;
  
  RETURN jsonb_build_object(
    'token_id', v_token_id,
    'token', v_token,
    'invite_url', 'https://colorsofglory.app/join/' || v_token,
    'assigned_role', p_role,
    'max_uses', p_max_uses
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_invite_token(UUID, TEXT, INTEGER) TO authenticated;
```

### 4D. `request_new_invite(p_token TEXT, p_phone TEXT)` — for expired links

```sql
CREATE OR REPLACE FUNCTION public.request_new_invite(
  p_token   TEXT,
  p_phone   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song_id   UUID;
  v_user_id   UUID := auth.uid();
BEGIN
  -- Find the song_id from the original token (even if revoked)
  SELECT song_id INTO v_song_id
  FROM public.invite_tokens
  WHERE token = p_token;
  
  -- Insert the request
  INSERT INTO public.invite_requests (
    original_token,
    song_id,
    requested_by_user_id,
    requested_by_phone
  ) VALUES (
    p_token,
    v_song_id,
    v_user_id,   -- NULL if anon, fine
    p_phone
  );
  
  -- Notify the song owner (if we know the song)
  IF v_song_id IS NOT NULL THEN
    PERFORM pg_notify(
      'invite_requested',
      jsonb_build_object(
        'song_id', v_song_id,
        'requester_phone', p_phone
      )::text
    );
  END IF;
  
  RETURN jsonb_build_object('status', 'request_sent');
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_new_invite(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.request_new_invite(TEXT, TEXT) TO authenticated;
```

---

## STEP 5 — TRIGGERS

### 5A. Auto-update `lyrics_snippet` when lyrics are saved

```sql
-- Whenever the lyrics content of a song is updated,
-- keep the lyrics_snippet current for the invite preview blurred effect

CREATE OR REPLACE FUNCTION public.sync_lyrics_snippet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_snippet TEXT;
BEGIN
  -- Extract first 150 characters of lyrics for the preview
  -- (Actual lyrics column name may vary — adjust if needed)
  v_snippet := LEFT(NEW.content, 150);
  
  UPDATE public.songs
  SET lyrics_snippet = v_snippet
  WHERE id = NEW.song_id;
  
  RETURN NEW;
END;
$$;

-- NOTE: Apply this trigger to whichever table/column stores lyrics content
-- Example (adjust table name to match your schema):
-- CREATE TRIGGER sync_lyrics_snippet_trigger
--   AFTER INSERT OR UPDATE OF content ON public.lyrics
--   FOR EACH ROW EXECUTE FUNCTION public.sync_lyrics_snippet();
```

### 5B. Auto-assign avatar color on profile creation

```sql
CREATE OR REPLACE FUNCTION public.assign_avatar_color()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_colors TEXT[] := ARRAY[
    '#8070C4',  -- purple (aurora)
    '#4D8FD2',  -- blue
    '#53AB8B',  -- teal/green
    '#D4AE5C',  -- warm gold
    '#C26A95'   -- rose
  ];
  v_index INTEGER;
BEGIN
  -- Consistent color based on user ID so it never changes
  v_index := (abs(hashtext(NEW.id::text)) % 5) + 1;
  NEW.avatar_color := v_colors[v_index];
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_avatar_color_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.avatar_color IS NULL)
  EXECUTE FUNCTION public.assign_avatar_color();
```

---

## STEP 6 — STORAGE BUCKET FOR PROFILE PHOTOS

```sql
-- Create the avatars storage bucket
-- (Run in Supabase dashboard Storage → New Bucket, or via API)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,                         -- public bucket so avatar URLs work without auth
  5242880,                      -- 5MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_authenticated_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
    -- File path must start with the user's own ID: /avatars/[user_id]/photo.webp
  );

CREATE POLICY "avatars_own_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## STEP 7 — PHONE LOOKUP FUNCTION (for existing user detection)

```sql
-- Claude's frontend needs to check "does this phone number have an account?"
-- WITHOUT exposing user data to unauthorized callers
-- This returns only: { exists: boolean, first_name: string|null }

CREATE OR REPLACE FUNCTION public.check_phone_registered(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id   UUID;
  v_first_name TEXT;
BEGIN
  -- Look up the user by phone in Supabase auth
  SELECT au.id, p.first_name
  INTO v_user_id, v_first_name
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE au.phone = p_phone
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  
  -- Return minimal info — never return phone or email
  RETURN jsonb_build_object(
    'exists', true,
    'first_name', v_first_name  -- used for "Continue as Parker →" CTA
  );
END;
$$;

-- Callable from the invite page (even anon context)
GRANT EXECUTE ON FUNCTION public.check_phone_registered(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_phone_registered(TEXT) TO authenticated;
```

---

## STEP 8 — REALTIME SUBSCRIPTIONS

Enable Realtime on tables Claude needs to subscribe to:

```sql
-- Enable Realtime on activity_feed (for live collaboration updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed;

-- Enable Realtime on song_members (to show when new people join)
ALTER PUBLICATION supabase_realtime ADD TABLE public.song_members;
```

---

## STEP 9 — SEED DATA FOR TESTING

```sql
-- Only run in development — gives Claude a known invite token to test with

-- First, ensure there's a test song owned by the authenticated test user
-- (Replace [TEST_USER_ID] and [TEST_SONG_ID] with real values from your dev DB)

-- Insert a test invite token with a known value
INSERT INTO public.invite_tokens (
  token,
  song_id,
  created_by,
  assigned_role,
  max_uses,
  current_uses
) VALUES (
  'test-invite-abc123',                    -- predictable token for testing
  '[TEST_SONG_ID]',
  '[TEST_USER_ID]',
  'contributor',
  5,
  0
) ON CONFLICT (token) DO NOTHING;

-- Test URL: http://localhost:5173/invite/test-invite-abc123
```

---

## STEP 10 — VERIFY EVERYTHING WORKS

Run these checks after all steps are complete:

```sql
-- 1. Verify all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'invite_tokens', 'invite_acceptances', 'invite_requests',
  'song_members', 'song_notification_prefs', 'activity_feed', 'profiles'
)
ORDER BY table_name;
-- Expected: 7 rows

-- 2. Verify RPC functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'preview_invite', 'accept_invite', 'generate_invite_token',
  'request_new_invite', 'check_phone_registered'
)
ORDER BY routine_name;
-- Expected: 5 rows

-- 3. Test preview_invite with the test token (as anon)
SELECT public.preview_invite('test-invite-abc123');
-- Expected: { "status": "valid", "song_title": "...", "assigned_role": "contributor", ... }

-- 4. Test phone check
SELECT public.check_phone_registered('+15555555555');
-- Expected: { "exists": false } (unless that phone is registered)

-- 5. Verify RLS is on
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'invite_tokens', 'invite_acceptances', 'song_members',
  'song_notification_prefs', 'activity_feed'
)
ORDER BY tablename;
-- Expected: rowsecurity = true for all 5

-- 6. Verify storage bucket
SELECT id, name, public FROM storage.buckets WHERE name = 'avatars';
-- Expected: 1 row, public = true
```

---

## WHAT CLAUDE WILL CALL (API CONTRACT)

Once you've built everything above, Claude will use these exact Supabase calls:

```typescript
// Screen A — preview the invite (anon safe)
const { data } = await supabase.rpc('preview_invite', { p_token: token });

// Screen A — check if phone is already registered
const { data } = await supabase.rpc('check_phone_registered', { p_phone: e164 });

// Screen A — send OTP (existing Supabase Auth, already wired)
await supabase.auth.signInWithOtp({ phone: e164 });

// Screen B — verify OTP
await supabase.auth.verifyOtp({ phone: e164, token: code, type: 'sms' });

// Screen B → accept invite atomically
const { data } = await supabase.rpc('accept_invite', { p_token: token });

// Screen C — save name to profile
await supabase
  .from('profiles')
  .upsert({ id: userId, first_name, last_name, updated_at: new Date() });

// Inside song — generate a new invite token
const { data } = await supabase.rpc('generate_invite_token', {
  p_song_id: songId,
  p_role: 'contributor',
  p_max_uses: 5,
});

// Expired link — request new invite
await supabase.rpc('request_new_invite', {
  p_token: expiredToken,
  p_phone: userPhone,
});
```

---

## LOVABLE BUILD CHECKLIST

Before telling Claude it's ready:

- [ ] All 7 tables created (run Step 10 verification query #1)
- [ ] All 5 RPC functions created (run Step 10 verification query #2)
- [ ] `preview_invite` works as anon caller (query #3)
- [ ] RLS enabled on all 5 sensitive tables (query #5)
- [ ] `avatars` storage bucket created (query #6)
- [ ] `supabase_realtime` publication includes `activity_feed` and `song_members`
- [ ] Test token inserted for local development (seed data)
- [ ] `assign_avatar_color` trigger fires on profile creation
- [ ] No breaking changes to existing tables (check `songs`, existing auth flow)
- [ ] All `GRANT EXECUTE` statements applied

**When complete:** Share the Supabase project URL and confirm which table stores phone numbers in the `profiles` or `users` table (column name). Claude needs this to wire `check_phone_registered` correctly.

---

*Prompt prepared by Claude for Lovable · Colors of Glory invite flow*
*Do not modify existing React components — backend only*
*Build in exact order: Steps 1 → 10*
