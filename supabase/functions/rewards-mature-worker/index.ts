import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { data: matured, error } = await supabase.rpc('mature_holds')
    if (error) throw error

    // On day 1 of the month, create monthly payout drafts for active founders
    const now = new Date()
    let createdPayouts = 0
    if (now.getUTCDate() === 1) {
      const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      const { data: founders } = await supabase
        .from('founders').select('id').eq('status', 'active')
      for (const f of founders ?? []) {
        const { data: payoutId } = await supabase.rpc('create_payout_batch', {
          _founder: f.id,
          _period_start: periodStart.toISOString(),
          _period_end: periodEnd.toISOString(),
        })
        if (payoutId) createdPayouts++
      }

      // Also create user-referrer monthly payout drafts
      const { data: userReferrers } = await supabase
        .from('reward_events')
        .select('referrer_user_id')
        .eq('reward_kind', 'cash')
        .eq('status', 'payable')
        .is('payout_id', null)
        .not('referrer_user_id', 'is', null)
        .gte('created_at', periodStart.toISOString())
        .lt('created_at', periodEnd.toISOString())
      const uniqUsers = Array.from(new Set((userReferrers ?? []).map((r: any) => r.referrer_user_id).filter(Boolean)))
      for (const uid of uniqUsers) {
        const { data: payoutId } = await supabase.rpc('create_user_payout_batch', {
          _user: uid,
          _period_start: periodStart.toISOString(),
          _period_end: periodEnd.toISOString(),
        })
        if (payoutId) createdPayouts++
      }
    }

    return new Response(JSON.stringify({ ok: true, matured, createdPayouts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})