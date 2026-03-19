# Stripe Edge Functions - Setup & Deployment Guide

## Overview
4 production-ready Deno Edge Functions for complete Stripe payment integration in PMS:
1. **generate-payment-schedule** - Creates payment schedule for bookings
2. **stripe-create-checkout** - Creates Stripe Checkout Sessions
3. **stripe-webhook** - Handles Stripe webhook events
4. **stripe-manage-preauth** - Manages preauthorized payments (security deposits)

## Directory Structure
```
supabase/
├── functions/
│   ├── generate-payment-schedule/
│   │   ├── index.ts
│   │   └── deno.json
│   ├── stripe-create-checkout/
│   │   ├── index.ts
│   │   └── deno.json
│   ├── stripe-webhook/
│   │   ├── index.ts
│   │   └── deno.json
│   ├── stripe-manage-preauth/
│   │   ├── index.ts
│   │   └── deno.json
│   └── README_STRIPE.md
├── migrations/
│   └── 20260319_stripe_integration.sql
└── .env.example
```

## Step 1: Apply Database Migration

```bash
cd /sessions/vibrant-tender-turing/mnt/prop-manage-planner-RECUPERO
supabase db push
```

This creates:
- `payment_settings` table (property-level payment configuration)
- New columns in `tenant_payments` (Stripe fields)
- New columns in `bookings` (payment tracking)
- Indices for performance

## Step 2: Set Environment Variables in Supabase

Go to Supabase Dashboard → Settings → Edge Functions → Secrets

Add:
```
STRIPE_SECRET_KEY=sk_test_... (or sk_live_...)
STRIPE_WEBHOOK_SECRET=whsec_...
```

To get these:
1. Sign into https://dashboard.stripe.com
2. Copy Secret Key from Developers → API Keys
3. Create webhook endpoint and copy signing secret

## Step 3: Deploy Edge Functions

```bash
supabase functions deploy generate-payment-schedule
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy stripe-manage-preauth
```

After deployment, Supabase CLI will output:
```
✓ Function deployed successfully.
Endpoint: https://<project-ref>.supabase.co/functions/v1/generate-payment-schedule
```

## Step 4: Configure Stripe Webhook Endpoint

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.amount_capturable_updated`
   - `charge.refunded`
5. Copy signing secret (starts with `whsec_`)
6. Update `STRIPE_WEBHOOK_SECRET` in Supabase secrets

## Step 5: Configure payment_settings for Properties

Insert a row in `payment_settings` for each property that accepts Stripe payments:

```sql
INSERT INTO payment_settings (
  property_id,
  caparra_percentage,
  caparra_due_days,
  saldo_due_days_before,
  cauzione_amount,
  cauzione_preauth_days_before,
  tassa_per_night,
  tassa_per_person,
  stripe_configured
) VALUES (
  'property-uuid-here',
  30.00,           -- 30% deposit
  7,               -- Due in 7 days
  14,              -- Balance due 14 days before check-in
  500.00,          -- €500 security deposit
  7,               -- Preauth due 7 days before check-in
  3.00,            -- €3 per night guest tax
  true,            -- Tax per person (not per booking)
  true             -- Enable Stripe for this property
);
```

## Step 6: Update Frontend URLs

In `stripe-create-checkout` function, success/cancel URLs point to:
```
https://prop-manage-planner.vercel.app/guest/{booking_id}?payment=success
https://prop-manage-planner.vercel.app/guest/{booking_id}?payment=cancelled
```

Update these if your domain differs.

## Testing

### Local Testing
```bash
supabase functions serve

# In another terminal
curl -X POST http://localhost:54321/functions/v1/generate-payment-schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <anon-key>" \
  -d '{"booking_id":"<booking-uuid>"}'
```

### Stripe Webhook Testing
```bash
# Install Stripe CLI from https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Trigger test event in Stripe Dashboard → Developers → Events
```

### Production Testing
1. Create a test booking with `stripe_configured = true`
2. Call `POST /generate-payment-schedule`
3. Verify payment records created with `stripe_checkout_url`
4. Guest clicks link and completes payment
5. Verify webhook receives `checkout.session.completed`
6. Check `tenant_payments.stato` updated to `pagato`

## Monitoring

### Check Webhook Deliveries
```bash
stripe logs tail --live
```

### Database Monitoring
```sql
-- Check all pending payments
SELECT id, tipo, importo, data_scadenza, stato
FROM tenant_payments
WHERE stato = 'da_pagare'
ORDER BY data_scadenza;

-- Check preauth payments
SELECT id, tipo, importo, preauth_captured_amount, preauth_released
FROM tenant_payments
WHERE is_preauth = true;

-- Check failed Stripe sessions
SELECT id, stripe_session_id, stripe_checkout_url
FROM tenant_payments
WHERE stripe_session_id IS NULL AND stripe_configured = true;
```

## Troubleshooting

### "Missing Supabase configuration"
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
- Check Supabase project settings

### "Missing Stripe configuration"
- Verify STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Supabase secrets
- Check Stripe account is active

### Webhook signature verification failed
- Verify STRIPE_WEBHOOK_SECRET matches exactly (whitespace matters)
- Check webhook endpoint URL is exactly correct

### Payment Intent not found
- Ensure `stripe_payment_intent_id` is populated in tenant_payments
- Check webhook was received and processed

### Partial capture fails
- Verify amount <= preauth amount
- Ensure preauth is in `pre_autorizzato` state

## Production Checklist

- [ ] Migration applied and verified
- [ ] STRIPE_SECRET_KEY set (sk_live_ if production)
- [ ] STRIPE_WEBHOOK_SECRET set
- [ ] Functions deployed successfully
- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] payment_settings configured for properties
- [ ] Frontend URLs updated (if not using vercel.app)
- [ ] Test payment flow end-to-end
- [ ] Webhook test events received and processed
- [ ] Error logging verified
- [ ] Backup/disaster recovery plan in place

## Reference

- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Stripe API: https://stripe.com/docs/api
- Stripe Webhooks: https://stripe.com/docs/webhooks
- Deno Manual: https://docs.deno.com
