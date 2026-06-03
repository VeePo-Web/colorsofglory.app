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

    if (action === 'create') {
      const { display_name, slug, tier, code_value, discount_cents, reward_profile, user_id } = body
      if (!display_name || !slug) return j({ error: 'missing_fields' }, 400)
      const { data: f, error: ferr } = await admin.from('founders').insert({
        display_name, slug, tier: tier ?? 'standard',
        user_id: user_id ?? null,
        reward_profile: reward_profile ?? undefined,
        created_by_user_id: actor.id,
      }).select().single()
      if (ferr) return j({ error: ferr.message }, 400)

      const value = (code_value ?? slug.toUpperCase() + '50').replace(/\s+/g, '')
      const { data: c, error: cerr } = await admin.from('codes').insert({
        value, kind: 'founder', owner_founder_id: f.id,
        discount_cents: discount_cents ?? 5000,
        created_by_user_id: actor.id,
      }).select().single()
      if (cerr) {
        await admin.from('founders').delete().eq('id', f.id)
        return j({ error: cerr.message }, 400)
      }
      await admin.rpc('write_audit', {
        _actor: actor.id, _action: 'create_founder', _entity_type: 'founder',
        _entity_id: f.id, _before: null, _after: f, _reason: null,
      })
      return j({ ok: true, founder: f, code: c })
    }

    if (action === 'pause' || action === 'resume' || action === 'revoke') {
      const { founder_id, reason } = body
      const status = action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'revoked'
      const patch: Record<string, unknown> = { status }
      if (action === 'pause') patch.paused_at = new Date().toISOString()
      if (action === 'revoke') patch.revoked_at = new Date().toISOString()
      const { data: before } = await admin.from('founders').select('*').eq('id', founder_id).single()
      const { data: after, error } = await admin.from('founders').update(patch).eq('id', founder_id).select().single()
      if (error) return j({ error: error.message }, 400)
      if (status !== 'active') {
        await admin.from('codes').update({ status: 'paused' }).eq('owner_founder_id', founder_id)
      } else {
        await admin.from('codes').update({ status: 'active' }).eq('owner_founder_id', founder_id).eq('status', 'paused')
      }
      await admin.rpc('write_audit', {
        _actor: actor.id, _action: action + '_founder', _entity_type: 'founder',
        _entity_id: founder_id, _before: before, _after: after, _reason: reason ?? null,
      })
      return j({ ok: true, founder: after })
    }

    if (action === 'edit_reward_profile') {
      const { founder_id, reward_profile, reason } = body
      const { data: before } = await admin.from('founders').select('*').eq('id', founder_id).single()
      const { data: after, error } = await admin.from('founders')
        .update({ reward_profile }).eq('id', founder_id).select().single()
      if (error) return j({ error: error.message }, 400)
      await admin.rpc('write_audit', {
        _actor: actor.id, _action: 'edit_reward_profile', _entity_type: 'founder',
        _entity_id: founder_id, _before: before, _after: after, _reason: reason ?? null,
      })
      return j({ ok: true, founder: after })
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