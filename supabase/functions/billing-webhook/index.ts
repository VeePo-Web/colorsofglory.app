import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Stripe webhook shell. No-ops with 503 until STRIPE_WEBHOOK_SECRET is set
// and Stripe is enabled on the project. When ready, install npm:stripe@14 and
// uncomment the signature verification block.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) {
    return json({ error: 'payments_not_enabled' }, 503)
  }

  const raw = await req.text()
  let event: any
  try {
    event = JSON.parse(raw)
  } catch {
    return json({ error: 'invalid_payload' }, 400)
  }
  // TODO: verify signature using stripe.webhooks.constructEvent(raw, sig, webhookSecret)

  const externalEventId: string = event.id
  if (!externalEventId) return json({ error: 'missing_event_id' }, 400)

  const kindMap: Record<string, string> = {
    'invoice.paid': 'invoice_paid',
    'invoice.payment_succeeded': 'invoice_paid',
    'invoice.refunded': 'invoice_refunded',
    'charge.refunded': 'invoice_refunded',
    'charge.dispute.created': 'chargeback_created',
    'customer.subscription.created': 'subscription_created',
    'customer.subscription.deleted': 'subscription_cancelled',
  }
  const kind = kindMap[event.type]
  if (!kind) return json({ ok: true, ignored: event.type })

  const obj = event.data?.object ?? {}
  const payload = {
    user_id: obj.metadata?.user_id ?? null,
    invoice_external_id: obj.id ?? null,
    subscription_external_id: obj.subscription ?? null,
    amount_cents: obj.amount_paid ?? obj.amount ?? 0,
    currency: obj.currency ?? 'usd',
  }

  const { error: insErr } = await supabase.from('billing_events').insert({
    kind,
    external_event_id: externalEventId,
    invoice_external_id: payload.invoice_external_id,
    user_id: payload.user_id,
    amount_cents: payload.amount_cents,
    currency: payload.currency,
    payload: event,
  })
  if (insErr && !String(insErr.message).includes('duplicate')) {
    return json({ error: insErr.message }, 500)
  }

  try {
    if (kind === 'invoice_paid') {
      await supabase.rpc('record_invoice_paid', { _event: payload })
    } else if (kind === 'invoice_refunded') {
      await supabase.rpc('record_invoice_refunded', { _event: payload })
    } else if (kind === 'chargeback_created') {
      await supabase.rpc('record_chargeback', { _event: payload })
    }
    await supabase.from('billing_events').update({ processed_at: new Date().toISOString() })
      .eq('external_event_id', externalEventId)
  } catch (e) {
    await supabase.from('billing_events').update({ processing_error: String(e) })
      .eq('external_event_id', externalEventId)
    return json({ error: String(e) }, 500)
  }

  return json({ ok: true })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}