import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const squareBase = Deno.env.get('SQUARE_ENVIRONMENT') === 'sandbox'
  ? 'https://connect.squareupsandbox.com'
  : 'https://connect.squareup.com'
const squareVersion = Deno.env.get('SQUARE_VERSION') || '2026-08-19'

async function validSignature(body: string, signature: string | null) {
  const key = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY') || ''
  const url = Deno.env.get('SQUARE_WEBHOOK_URL') || ''
  if (!key || !url || !signature) return false
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(url + body))
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
  if (expected.length !== signature.length) return false
  let difference = 0
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return difference === 0
}

async function square(path: string) {
  const response = await fetch(`${squareBase}${path}`, { headers: { Authorization: `Bearer ${Deno.env.get('SQUARE_ACCESS_TOKEN')}`, 'Square-Version': squareVersion, 'Content-Type': 'application/json' } })
  if (!response.ok) throw new Error(`Square ${response.status}: ${await response.text()}`)
  return response.json()
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const body = await req.text()
  if (!(await validSignature(body, req.headers.get('x-square-hmacsha256-signature')))) return new Response('Invalid signature', { status: 401 })
  try {
    const event = JSON.parse(body)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    if (event.type === 'subscription.created' || event.type === 'subscription.updated') {
      const subscription = event.data?.object?.subscription
      if (!subscription?.id) throw new Error('Subscription payload is missing an id')
      const customer = (await square(`/v2/customers/${subscription.customer_id}`)).customer || {}
      let planName = 'Subscription', amount = 0, currency = 'USD'
      if (subscription.plan_variation_id) {
        const catalog = (await square(`/v2/catalog/object/${subscription.plan_variation_id}?include_related_objects=true`))
        const variation = catalog.object?.subscription_plan_variation_data
        planName = variation?.name || catalog.related_objects?.find((x:any)=>x.type==='SUBSCRIPTION_PLAN')?.subscription_plan_data?.name || planName
        const phase = variation?.phases?.find((x:any)=>x.pricing?.type==='STATIC') || variation?.phases?.[0]
        amount = phase?.pricing?.price_money?.amount || 0
        currency = phase?.pricing?.price_money?.currency || currency
      }
      const email = String(customer.email_address || '').toLowerCase()
      const { data: person } = email ? await supabase.from('crm').select('id,userid').ilike('email', email).limit(1).maybeSingle() : { data: null }
      const row = { crmid: person?.id || null, userid: person?.userid || null, source: 'square_webhook', sourceid: subscription.id, customerid: subscription.customer_id, subscriptionid: subscription.id, name: [customer.given_name, customer.family_name].filter(Boolean).join(' '), company: customer.company_name || '', email: customer.email_address || '', phone: customer.phone_number || '', plan: planName, status: subscription.status, amount, currency, cadence: 'MONTHLY', startdate: subscription.start_date || null, canceled: subscription.canceled_date || null, chargedthrough: subscription.charged_through_date || null, original: { planvariationid: subscription.plan_variation_id || null }, updated: new Date().toISOString() }
      const { error } = await supabase.from('square').upsert(row, { onConflict: 'source,sourceid' })
      if (error) throw error
      if (person?.id && ['ACTIVE','PENDING'].includes(subscription.status)) await supabase.from('crm').update({ relationship: 'client', stage: 'complete', updated: new Date().toISOString() }).eq('id', person.id)
    }
    if (event.type === 'payment.created' || event.type === 'payment.updated') {
      const payment = event.data?.object?.payment
      if (payment?.id && payment.customer_id) {
        const { data: subscription } = await supabase.from('square').select('id,crmid').eq('customerid', payment.customer_id).order('created', { ascending: false }).limit(1).maybeSingle()
        const card = payment.card_details?.card || {}
        const { error } = await supabase.from('payments').upsert({ crmid: subscription?.crmid || null, squareid: subscription?.id || null, source: 'square_webhook', sourceid: payment.id, customerid: payment.customer_id, status: payment.status, amount: payment.amount_money?.amount || 0, currency: payment.amount_money?.currency || 'USD', paid: payment.status === 'COMPLETED' ? payment.updated_at || payment.created_at : null, card: card.card_brand || null, lastfour: card.last_4 || null, receipt: payment.receipt_url || null, updated: new Date().toISOString() }, { onConflict: 'source,sourceid' })
        if (error) throw error
      }
    }
    return new Response('ok')
  } catch (error) {
    console.error(error)
    return new Response(error instanceof Error ? error.message : 'Webhook failed', { status: 500 })
  }
})
