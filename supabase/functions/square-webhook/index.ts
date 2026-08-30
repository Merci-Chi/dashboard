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
      const { data: project } = email ? await supabase.from('site_projects').select('id').ilike('email', email).limit(1).maybeSingle() : { data: null }
      const row = { id: subscription.id, site_project_id: project?.id || null, square_customer_id: subscription.customer_id, customer_name: [customer.given_name, customer.family_name].filter(Boolean).join(' '), customer_company: customer.company_name || null, customer_email: customer.email_address || null, customer_phone: customer.phone_number || null, plan_variation_id: subscription.plan_variation_id || null, plan_name: planName, status: subscription.status, amount_money: amount, currency, start_date: subscription.start_date || null, canceled_date: subscription.canceled_date || null, charged_through_date: subscription.charged_through_date || null, updated_at: new Date().toISOString() }
      const { error } = await supabase.from('billing_subscriptions').upsert(row)
      if (error) throw error
      await supabase.from('payment_history').update({ subscription_id: subscription.id }).eq('square_customer_id', subscription.customer_id).is('subscription_id', null)
      if (project?.id && ['ACTIVE','PENDING'].includes(subscription.status)) await supabase.from('site_projects').update({ status: 'client' }).eq('id', project.id)
    }
    if (event.type === 'payment.created' || event.type === 'payment.updated') {
      const payment = event.data?.object?.payment
      if (payment?.id && payment.customer_id) {
        const { data: subscription } = await supabase.from('billing_subscriptions').select('id').eq('square_customer_id', payment.customer_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        const card = payment.card_details?.card || {}
        const { error } = await supabase.from('payment_history').upsert({ id: payment.id, subscription_id: subscription?.id || null, square_customer_id: payment.customer_id, status: payment.status, amount_money: payment.amount_money?.amount || 0, currency: payment.amount_money?.currency || 'USD', paid_at: payment.status === 'COMPLETED' ? payment.updated_at || payment.created_at : null, card_brand: card.card_brand || null, card_last_4: card.last_4 || null, receipt_url: payment.receipt_url || null, updated_at: new Date().toISOString() })
        if (error) throw error
      }
    }
    return new Response('ok')
  } catch (error) {
    console.error(error)
    return new Response(error instanceof Error ? error.message : 'Webhook failed', { status: 500 })
  }
})
