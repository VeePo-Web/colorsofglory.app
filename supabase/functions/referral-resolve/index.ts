import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { code, slug } = await req.json().catch(() => ({}))
    if (!code && !slug) {
      return new Response(JSON.stringify({ error: 'code_or_slug_required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (slug) {
      const { data: f } = await supabase
        .from('founders')
        .select('id, display_name, status, slug')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle()
      if (!f) return new Response(JSON.stringify({ ok: false }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
      const { data: c } = await supabase
        .from('codes')
        .select('value, kind, discount_cents, status')
        .eq('owner_founder_id', f.id)
        .eq('status', 'active')
        .maybeSingle()
      const { count: lifetimeCount } = await supabase
        .from('referral_attributions')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_founder_id', f.id)
      return new Response(JSON.stringify({
        ok: true, kind: 'founder', owner_display_name: f.display_name,
        code: c?.value ?? null, discount_cents: c?.discount_cents ?? 0,
        owner_lifetime_referred_count: lifetimeCount ?? 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: c } = await supabase
      .from('codes')
      .select('value, kind, discount_cents, status, owner_founder_id, owner_user_id')
      .eq('value', code)
      .eq('status', 'active')
      .maybeSingle()
    if (!c) return new Response(JSON.stringify({ ok: false }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

    let display_name: string | null = null
    let lifetimeCount = 0
    if (c.owner_founder_id) {
      const { data: f } = await supabase.from('founders').select('display_name').eq('id', c.owner_founder_id).maybeSingle()
      display_name = f?.display_name ?? null
      const { count } = await supabase
        .from('referral_attributions')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_founder_id', c.owner_founder_id)
      lifetimeCount = count ?? 0
    } else if (c.owner_user_id) {
      const { data: p } = await supabase.from('profiles').select('display_name').eq('user_id', c.owner_user_id).maybeSingle()
      display_name = p?.display_name ?? null
      const { count } = await supabase
        .from('referral_attributions')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_user_id', c.owner_user_id)
      lifetimeCount = count ?? 0
    }
    return new Response(JSON.stringify({
      ok: true, kind: c.kind, owner_display_name: display_name,
      code: c.value, discount_cents: c.discount_cents ?? 0,
      owner_lifetime_referred_count: lifetimeCount,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})