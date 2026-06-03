import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return json({ error: 'unauthorized' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userRes } = await userClient.auth.getUser(token)
    const user = userRes?.user
    if (!user) return json({ error: 'unauthorized' }, 401)

    const { code, source } = await req.json().catch(() => ({}))
    if (!code) return json({ error: 'code_required' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: attr, error: aerr } = await admin.rpc('attribute_referral', {
      _referred_user: user.id,
      _code_value: code,
      _source: source ?? 'founder_code',
    })
    if (aerr) return json({ error: aerr.message }, 400)
    const { error: rerr } = await admin.rpc('redeem_code', { _user: user.id, _code_value: code })
    if (rerr) return json({ error: rerr.message }, 400)
    return json({ ok: true, attribution: attr })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}