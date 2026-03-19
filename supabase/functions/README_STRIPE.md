# Stripe Integration Edge Functions

This directory contains 4 production-ready Deno-based Edge Functions for Stripe payment integration in the PMS system.

## Setup

1. Apply the migration to create `payment_settings` table and update `tenant_payments`:
   ```bash
   supabase db push
   ```

2. Set Stripe environment variables in Supabase:
   - `STRIPE_SECRET_KEY`: Your Stripe secret key
   - `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook signing secret

3. Configure webhook endpoint in Stripe Dashboard:
   - URL: `https://{your-project}.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `payment_intent.amount_capturable_updated`, `charge.refunded`

## Functions Overview

### 1. generate-payment-schedule
**Path:** `/generate-payment-schedule`

Generates complete payment schedule for a booking.

**Request:**
```json
{
  "booking_id": "uuid"
}
```

**Flow:**
1. Fetches booking details (dates, amount, guests)
2. Reads payment_settings for the property (or uses defaults)
3. Calculates nights between check-in and check-out
4. Creates 4 tenant_payments rows:
   - Caparra (deposit): 30% of total, due 7 days from now
   - Saldo (balance): remaining 70%, due 14 days before check-in
   - Cauzione (security deposit): fixed amount, preauth, due 7 days before check-in
   - Tassa soggiorno (guest tax): per night or per person

5. If Stripe is configured, invokes `stripe-create-checkout` for each payment
6. Sets `bookings.payment_schedule_generated = true`

**Response:**
```json
{
  "success": true,
  "booking_id": "uuid",
  "payments_generated": 4,
  "nights": 3,
  "caparra_due": "2026-03-26",
  "saldo_due": "2026-03-26",
  "cauzione_due": "2026-03-26"
}
```

---

### 2. stripe-create-checkout
**Path:** `/stripe-create-checkout`

Creates Stripe Checkout Session for a payment.

**Request:**
```json
{
  "payment_id": "uuid"
}
```

**Flow:**
1. Fetches payment, booking, property, and payment_settings
2. Creates Stripe Checkout Session with:
   - `mode: 'payment'`
   - EUR currency in centesimi
   - `capture_method: 'manual'` if payment is preauth (cauzione)
   - Success/cancel URLs pointing to guest portal
   - Metadata: `payment_id` and `booking_id`

3. Updates tenant_payments with:
   - `stripe_session_id`
   - `stripe_checkout_url`
   - `stripe_payment_intent_id`

**Response:**
```json
{
  "success": true,
  "payment_id": "uuid",
  "booking_id": "uuid",
  "session_id": "cs_...",
  "checkout_url": "https://checkout.stripe.com/...",
  "is_preauth": false
}
```

---

### 3. stripe-webhook
**Path:** `/stripe-webhook`

Handles Stripe webhook events (NO CORS).

**Webhook Signature Verification:**
Verifies `stripe-signature` header using `STRIPE_WEBHOOK_SECRET`.

**Supported Events:**

#### checkout.session.completed
Updates payment to `pagato` (paid) with payment date and receipt URL.

#### payment_intent.amount_capturable_updated
Updates payment to `pre_autorizzato` (preauthorized) when funds are held.

#### charge.refunded
Updates payment to `rimborsato` (refunded).

**Response:**
```json
{
  "processed": true,
  "event_type": "checkout.session.completed"
}
```

---

### 4. stripe-manage-preauth
**Path:** `/stripe-manage-preauth`

Manages preauthorized payments (cauzione).

**Request:**
```json
{
  "payment_id": "uuid",
  "action": "release" | "capture_full" | "capture_partial",
  "amount": 100.50
}
```

**Actions:**

#### release
- Cancels the Payment Intent
- Sets payment to `rilasciato` (released)
- Sets `preauth_released = true`

#### capture_full
- Captures full preauth amount
- Sets payment to `pagato` (paid)
- Sets `preauth_captured_amount` to full amount
- Sets payment_date

#### capture_partial
- Captures specified amount only
- Sets `preauth_captured_amount` to captured amount
- Validates amount <= payment amount

**Response:**
```json
{
  "success": true,
  "payment_id": "uuid",
  "action": "captured_full",
  "new_status": "pagato"
}
```

---

## payment_settings Schema

Table for property-specific payment configuration:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | auto | Primary key |
| `property_id` | UUID | - | Reference to properties_real |
| `caparra_percentage` | NUMERIC(5,2) | 30.00 | % of total for deposit |
| `caparra_due_days` | INTEGER | 7 | Days until caparra due |
| `saldo_due_days_before` | INTEGER | 14 | Days before check-in for balance |
| `cauzione_amount` | NUMERIC(10,2) | 500.00 | Fixed security deposit amount |
| `cauzione_preauth_days_before` | INTEGER | 7 | Days before check-in for preauth |
| `tassa_per_night` | NUMERIC(10,2) | 3.00 | Guest tax per night |
| `tassa_per_person` | BOOLEAN | true | Tax per person (else per booking) |
| `stripe_configured` | BOOLEAN | false | Enable Stripe payment flow |
| `stripe_key` | TEXT | null | Custom Stripe key (unused in functions) |
| `created_at` | TIMESTAMP | now | Creation timestamp |
| `updated_at` | TIMESTAMP | now | Update timestamp |

---

## tenant_payments Updated Schema

New columns for Stripe integration:

| Column | Type | Description |
|--------|------|-------------|
| `is_preauth` | BOOLEAN | If true, this payment is preauthorized (cauzione) |
| `stripe_session_id` | TEXT | Stripe Checkout Session ID |
| `stripe_checkout_url` | TEXT | URL for guest to pay |
| `stripe_payment_intent_id` | TEXT | Stripe Payment Intent ID |
| `payment_date` | TIMESTAMP | When payment was completed |
| `receipt_url` | TEXT | Link to receipt/charge details |
| `preauth_released` | BOOLEAN | If preauth was released (not captured) |
| `preauth_captured_amount` | NUMERIC(10,2) | Amount captured from preauth |

Updated `stato` values:
- `da_pagare` (to pay)
- `pagato` (paid)
- `scaduto` (overdue)
- `pre_autorizzato` (preauthorized hold)
- `rilasciato` (released)
- `rimborsato` (refunded)

---

## Typical Workflow

### For Guest (Caparra + Saldo)
1. Booking created
2. `POST /generate-payment-schedule` → Creates caparra + saldo
3. Each creates Stripe Checkout Session
4. Guest receives payment links
5. Guest pays → Stripe webhook updates `stato = 'pagato'`
6. Saldo due near check-in

### For Security Deposit (Cauzione)
1. Cauzione payment created as preauth 7 days before check-in
2. Guest pays via Checkout → Payment Intent held (manual capture)
3. Webhook: `payment_intent.amount_capturable_updated` → `stato = 'pre_autorizzato'`
4. After check-out:
   - If no damage: `POST /stripe-manage-preauth` with `action: 'release'` → funds released
   - If damage: `POST /stripe-manage-preauth` with `action: 'capture_full'` → funds captured
   - If partial damage: `POST /stripe-manage-preauth` with `action: 'capture_partial', amount: 150.00`

---

## Error Handling

All functions return structured JSON errors:

```json
{
  "error": "Payment not found: unknown"
}
```

HTTP Status Codes:
- `200`: Success
- `400`: Bad request (missing fields, invalid action)
- `405`: Method not allowed
- `500`: Server error (Stripe API failure, database error)

---

## Testing

### Local Testing with Supabase CLI
```bash
supabase functions serve

curl -X POST http://localhost:54321/functions/v1/generate-payment-schedule \
  -H "Content-Type: application/json" \
  -d '{"booking_id":"<booking-uuid>"}'
```

### Stripe Webhook Testing
```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

Then trigger events in Stripe Dashboard → Developers → Events.

---

## Security Notes

- All functions use `SUPABASE_SERVICE_ROLE_KEY` (server-side auth only)
- Webhook endpoint verifies Stripe signature; no CORS headers
- Payment URLs are signed by Stripe; guests don't need auth
- Preauth flows use Stripe's manual capture to prevent unauthorized charges
- All monetary amounts stored as NUMERIC(10,2) for precision
