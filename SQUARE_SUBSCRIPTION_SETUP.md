# Square subscription sync setup

The dashboard code is ready, but Square must be allowed to send subscription and payment events to Supabase.

1. Run `supabase db push` to create `billing_subscriptions` and `payment_history`.
2. Set Edge Function secrets: `SQUARE_ACCESS_TOKEN`, `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_URL`, `SQUARE_ENVIRONMENT=production`, and optionally `SQUARE_VERSION=2026-08-20`.
3. Deploy with `supabase functions deploy square-webhook --no-verify-jwt`.
4. In the Square Developer Console, create a production webhook using the exact URL saved in `SQUARE_WEBHOOK_URL`: `https://glonbvrcudwuzjundrii.supabase.co/functions/v1/square-webhook`.
5. Subscribe it to `subscription.created`, `subscription.updated`, `payment.created`, and `payment.updated`.
6. Use Square's webhook test button, then make one real test subscription purchase.

Never place the Square access token or webhook signature key in browser JavaScript or commit them to GitHub.
