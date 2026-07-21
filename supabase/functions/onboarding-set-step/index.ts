import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { enqueueEmail } from '../_shared/emailGovernance.ts';

const STEPS = [
  'not_started','intent_selected','founder_code_seen','first_song_created',
  'first_idea_captured','first_voice_memo_added','first_lyrics_added',
  'first_collaborator_invited','completed','dismissed',
] as const;

const BodySchema = z.object({
  to: z.enum(STEPS),
  patch: z.record(z.unknown()).optional(),
  source: z.enum(['user','system','client']).optional().default('user'),
});

const NEXT_ROUTE: Record<string, (firstSongId: string | null) => string> = {
  not_started: () => '/onboarding/intent',
  intent_selected: () => '/onboarding/founder-code',
  founder_code_seen: () => '/onboarding/start-song',
  first_song_created: (id) => id ? `/songs/${id}` : '/',
  first_idea_captured: (id) => id ? `/songs/${id}/voice` : '/',
  first_voice_memo_added: (id) => id ? `/songs/${id}/lyrics` : '/',
  first_lyrics_added: (id) => id ? `/songs/${id}/people` : '/',
  first_collaborator_invited: (id) => id ? `/songs/${id}` : '/',
  completed: () => '/',
  dismissed: () => '/',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ ok: false, code: 'UNAUTHENTICATED', message: 'Missing bearer token' }, 401);
  }

  // Validate JWT and extract user
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ ok: false, code: 'UNAUTHENTICATED', message: 'Invalid token' }, 401);
  }
  const userId = userData.user.id;

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return json({ ok: false, code: 'INVALID_INPUT', message: 'Body must be JSON' }, 200);
  }
  if (!parsed.success) {
    return json({ ok: false, code: 'INVALID_INPUT', issues: parsed.error.flatten() }, 200);
  }
  const { to, patch, source } = parsed.data;

  // Patch size guard (2 KB)
  if (patch && JSON.stringify(patch).length > 2048) {
    return json({ ok: false, code: 'INVALID_INPUT', message: 'patch too large' }, 200);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: result, error: rpcErr } = await admin.rpc('advance_onboarding', {
    _user_id: userId,
    _to: to,
    _patch: patch ?? {},
    _source: source,
  });

  if (rpcErr) {
    console.error('advance_onboarding error', rpcErr);
    return json({ ok: false, code: 'INTERNAL', message: rpcErr.message }, 500);
  }

  // Re-read profile state
  const { data: prof, error: profErr } = await admin
    .from('profiles')
    .select('onboarding_step, onboarding_state, onboarding_updated_at, first_song_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profErr || !prof) {
    return json({ ok: false, code: 'INTERNAL', message: profErr?.message ?? 'profile missing' }, 500);
  }

  const nextRoute = NEXT_ROUTE[prof.onboarding_step]?.(prof.first_song_id ?? null) ?? '/';

  // A1/A2 (docs/email/COG-EMAIL-SYSTEM.md §5): the first successful step a
  // user ever sets is the "account is real" moment. Enqueue the welcome
  // (instant) + the first-song nudge (+24h; the drain re-checks "still no
  // song" and evaporates if one exists). dedupe_key = once ever, enforced
  // by the DB, so re-running onboarding can never double-send. Non-fatal.
  if (result === 'OK') {
    try {
      const { data: emailProf } = await admin
        .from('profiles')
        .select('email, first_name')
        .eq('user_id', userId)
        .maybeSingle();
      if (emailProf?.email) {
        await enqueueEmail(admin, {
          user_id: userId,
          kind: 'onboarding.welcome',
          category: 'onboarding',
          payload: { first_name: emailProf.first_name ?? null },
          dedupe_key: `onboarding.welcome:${userId}`,
        });
        await enqueueEmail(admin, {
          user_id: userId,
          kind: 'onboarding.first_song_nudge',
          category: 'onboarding',
          scheduled_for: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          dedupe_key: `onboarding.first_song_nudge:${userId}`,
        });
      }
    } catch (e) {
      console.error('[onboarding-set-step] email_enqueue_failed', String(e));
    }
  }

  if (result === 'OK') {
    return json({
      ok: true,
      step: prof.onboarding_step,
      state: prof.onboarding_state,
      first_song_id: prof.first_song_id,
      updated_at: prof.onboarding_updated_at,
      next_suggested_route: nextRoute,
    }, 200);
  }

  // Expected envelope errors — 200 status so UI can self-correct calmly
  if (result === 'INVALID_TRANSITION' || result === 'TERMINAL' || result === 'PROFILE_NOT_FOUND') {
    return json({
      ok: false,
      code: result === 'TERMINAL' ? 'ONBOARDING_TERMINAL' : result,
      current_step: prof.onboarding_step,
      first_song_id: prof.first_song_id,
      next_suggested_route: nextRoute,
    }, 200);
  }

  return json({ ok: false, code: 'UNKNOWN', message: String(result) }, 500);
});