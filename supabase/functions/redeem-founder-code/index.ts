import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const BodySchema = z.object({
  code: z.string().trim().min(4).max(32),
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function nextRouteFor(step: string | null | undefined): string {
  switch (step) {
    case 'founder_code_seen':
      return '/onboarding/start-song';
    case 'first_song_created':
      return '/onboarding/capture';
    default:
      return '/onboarding';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);

  // Auth: validate bearer JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ ok: false, code: 'UNAUTHENTICATED' }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ ok: false, code: 'UNAUTHENTICATED' }, 401);
  const userId = userData.user.id;

  // Validate body
  let body: unknown;
  try { body = await req.json(); } catch { return json({ ok: false, code: 'INVALID_BODY' }, 400); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, code: 'INVALID_BODY', issues: parsed.error.flatten() }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('redeem_founder_code', {
    _user_id: userId,
    _code: parsed.data.code.toUpperCase(),
  });

  if (error) {
    console.error('redeem_founder_code rpc error', error);
    return json({ ok: false, code: 'INTERNAL_ERROR' }, 500);
  }

  const envelope = (data ?? {}) as Record<string, unknown>;
  const onboarding = (envelope.onboarding ?? {}) as Record<string, unknown>;
  const step = (onboarding.step as string | undefined) ?? null;

  if (envelope.ok) {
    return json({
      ok: true,
      code: 'OK',
      perks: envelope.perks ?? {},
      onboarding_step: step,
      next_suggested_route: nextRouteFor(step),
    });
  }

  return json({
    ok: false,
    code: envelope.code ?? 'UNKNOWN',
    onboarding_step: step,
  });
});