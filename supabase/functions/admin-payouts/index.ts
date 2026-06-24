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
    const actor = u?.user
    if (!actor) return j({ error: 'unauthorized' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: actor.id, _role: 'admin' })
    if (!isAdmin) return j({ error: 'forbidden' }, 403)

    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    if (action === 'list_drafts') {
      const { data, error } = await admin.from('payouts').select('*').eq('status', 'draft').order('created_at', { ascending: false })
      if (error) return j({ error: error.message }, 400)
      return j({ ok: true, payouts: data })
    }
    if (action === 'create_batch') {
      const { founder_id, period_start, period_end } = body
      const { data, error } = await userClient.rpc('create_payout_batch', {
        _founder: founder_id, _period_start: period_start, _period_end: period_end,
      })
      if (error) return j({ error: error.message }, 400)
      return j({ ok: true, payout_id: data })
    }
    if (action === 'approve') {
      const { data, error } = await userClient.rpc('approve_payout', { _payout: body.payout_id })
      if (error) return j({ error: error.message }, 400)
      return j({ ok: true, payout: data })
    }
    if (action === 'mark_paid') {
      const { data, error } = await userClient.rpc('mark_payout_paid', {
        _payout: body.payout_id, _provider_id: body.provider_id ?? '',
      })
      if (error) return j({ error: error.message }, 400)
      return j({ ok: true, payout: data })
    }
    if (action === 'mark_failed') {
      const { data, error } = await userClient.rpc('mark_payout_failed', {
        _payout: body.payout_id, _reason: body.reason ?? '',
      })
      if (error) return j({ error: error.message }, 400)
      return j({ ok: true, payout: data })
    }
    if (action === 'retry') {
      const { data, error } = await userClient.rpc('retry_payout', { _payout: body.payout_id })
      if (error) return j({ error: error.message }, 400)
      return j({ ok: true, payout: data })
    }
    return j({ error: 'unknown_action' }, 400)
  } catch (e) {
    return j({ error: String(e) }, 500)
  }
})

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}