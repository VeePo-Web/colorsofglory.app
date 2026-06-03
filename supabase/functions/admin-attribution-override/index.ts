import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return j({ error: 'unauthorized' }, 401)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: u } = await userClient.auth.getUser(token)
    if (!u?.user) return j({ error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const { referred_user_id, new_referrer_type, new_referrer_id, reason } = body
    if (!referred_user_id || !new_referrer_type || !new_referrer_id) {
      return j({ error: 'missing_fields' }, 400)
    }
    const { data, error } = await userClient.rpc('admin_override_attribution', {
      _referred_user: referred_user_id,
      _new_referrer_type: new_referrer_type,
      _new_referrer_id: new_referrer_id,
      _reason: reason ?? null,
    })
    if (error) return j({ error: error.message }, 400)
    return j({ ok: true, attribution: data })
  } catch (e) {
    return j({ error: String(e) }, 500)
  }
})

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}