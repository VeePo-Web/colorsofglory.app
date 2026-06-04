import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// v2: this function NO LONGER writes to referral_attributions. Writing an
// attribution before checkout was racing the "one code per buyer" gate in
// create-checkout and locking real customers out of their own code.
//
// It now performs a light existence check and stashes the normalized code
// on profiles.pending_code. The authoritative attribution is written by
// payments-webhook after Stripe confirms the subscription.
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

    const { code } = await req.json().catch(() => ({}))
    if (!code) return json({ error: 'code_required' }, 400)
    const normalized = String(code).trim().toUpperCase()

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: founderCode } = await admin
      .from('codes')
      .select('id, kind, status')
      .eq('value', normalized)
      .eq('kind', 'founder')
      .maybeSingle()
    let kind: 'founder' | 'member_referral' | null = null
    if (founderCode && founderCode.status === 'active') {
      kind = 'founder'
    } else {
      const { data: referrer } = await admin
        .from('profiles')
        .select('user_id')
        .eq('referral_code', normalized)
        .maybeSingle()
      if (referrer && referrer.user_id !== user.id) kind = 'member_referral'
    }
    if (!kind) return json({ error: 'invalid_code' }, 400)

    const { error: serr } = await admin.rpc('stash_pending_code', {
      _user_id: user.id,
      _code: normalized,
    })
    if (serr) return json({ error: serr.message }, 500)
    return json({ ok: true, kind, pending_code: normalized })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}