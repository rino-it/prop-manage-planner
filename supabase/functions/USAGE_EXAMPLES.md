# Stripe Edge Functions - Usage Examples

## Example 1: Generate Payment Schedule for a Booking

Create full payment schedule (caparra, saldo, cauzione, tassa soggiorno) with one call.

**Client-side call:**
```typescript
const bookingId = "550e8400-e29b-41d4-a716-446655440000";

const response = await fetch(
  `${supabaseUrl}/functions/v1/generate-payment-schedule`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ booking_id: bookingId }),
  }
);

const result = await response.json();
// {
//   "success": true,
//   "booking_id": "550e8400-e29b-41d4-a716-446655440000",
//   "payments_generated": 4,
//   "nights": 3,
//   "caparra_due": "2026-03-26",
//   "saldo_due": "2026-03-26",
//   "cauzione_due": "2026-03-26"
// }
```

**What happens internally:**
1. Fetches booking: dates, total amount, guest count
2. Reads payment_settings for property (or defaults)
3. Calculates nights: 3
4. Inserts 4 rows in tenant_payments:
   - Caparra (€300 if total €1000): due 2026-03-26
   - Saldo (€700): due 2026-03-26
   - Cauzione (€500 preauth): due 2026-03-26
   - Tassa soggiorno (€9 = €3 * 3 nights * 1 guest): due check-in date
5. For each payment, if stripe_configured=true, creates Stripe Checkout Session
6. Updates booking: payment_schedule_generated=true

---

## Example 2: Guest Receives Payment Link

After schedule is generated, guest receives email with payment links.

**What the guest sees:**
```
Caro Marco,

Ecco i tuoi pagamenti per la prenotazione:

1. CAPARRA (Deposito): €300
   Scadenza: 26 marzo 2026
   Paga ora: https://checkout.stripe.com/pay/cs_test_...

2. SALDO: €700
   Scadenza: 26 marzo 2026
   Paga ora: https://checkout.stripe.com/pay/cs_test_...

3. CAUZIONE: €500 (Trattenuta)
   Scadenza: 26 marzo 2026
   Paga ora: https://checkout.stripe.com/pay/cs_test_...

4. TASSA SOGGIORNO: €9
   Scadenza: 28 marzo 2026
   Paga ora: https://checkout.stripe.com/pay/cs_test_...

Grazie!
```

Guest clicks link → Stripe Checkout Session → Credit card form → Pay → Success page

---

## Example 3: Webhook Processes Payment (Automatic)

When guest completes payment, Stripe fires webhook to your function.

**Stripe webhook event (behind the scenes):**
```json
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_...",
      "payment_intent": "pi_test_...",
      "metadata": {
        "payment_id": "550e8400-e29b-41d4-a716-446655440000",
        "booking_id": "660e8400-e29b-41d4-a716-446655440000"
      }
    }
  }
}
```

**Your function webhook handler:**
1. Verifies Stripe signature
2. Extracts payment_id from metadata
3. Updates tenant_payments:
   - stato = 'pagato'
   - payment_date = now
   - receipt_url = https://dashboard.stripe.com/payments/pi_test_...
4. Returns 200 OK

**Database result:**
```sql
SELECT id, tipo, importo, stato, payment_date FROM tenant_payments
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- id                  | tipo     | importo | stato  | payment_date
-- 550e8400-e29b-41d4  | caparra  | 300.00  | pagato | 2026-03-19 14:23:45+00
```

---

## Example 4: Preauthorized Security Deposit (Cauzione)

Cauzione uses manual capture mode so you can hold funds until check-out verification.

**Payment created:**
```json
{
  "booking_id": "660e8400-e29b-41d4-a716-446655440000",
  "tipo": "cauzione",
  "importo": 500.00,
  "data_scadenza": "2026-03-26",
  "is_preauth": true,
  "stato": "da_pagare"
}
```

**Guest pays in Checkout:**
- Stripe creates Payment Intent with capture_method='manual'
- Guest card is authorized but NOT charged
- Payment Intent moves to requires_capture state

**Webhook fires:**
```json
{
  "type": "payment_intent.amount_capturable_updated",
  "data": {
    "object": {
      "id": "pi_test_...",
      "status": "requires_capture",
      "metadata": {
        "payment_id": "550e8400-e29b-41d4-a716-446655440000"
      }
    }
  }
}
```

**Function updates:**
```sql
UPDATE tenant_payments
SET stato = 'pre_autorizzato'
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

---

## Example 5: Release Preauth (No Damage)

After check-out, if property has no damage, release the hold.

**Admin calls:**
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/stripe-manage-preauth`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`, // Server-side only
    },
    body: JSON.stringify({
      payment_id: "550e8400-e29b-41d4-a716-446655440000",
      action: "release",
    }),
  }
);

const result = await response.json();
// {
//   "success": true,
//   "payment_id": "550e8400-e29b-41d4-a716-446655440000",
//   "action": "released",
//   "new_status": "rilasciato"
// }
```

**What happens:**
1. Fetches payment and its Stripe Payment Intent ID
2. Calls stripe.paymentIntents.cancel()
3. Stripe releases the card hold
4. Updates tenant_payments:
   - stato = 'rilasciato'
   - preauth_released = true

**Guest card:**
- Authorization is cancelled
- No charge appears on statement
- Takes 3-5 business days for hold to disappear

---

## Example 6: Capture Full Preauth (Damage Found)

After check-out, if property has damage, capture full amount.

**Admin calls:**
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/stripe-manage-preauth`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      payment_id: "550e8400-e29b-41d4-a716-446655440000",
      action: "capture_full",
    }),
  }
);

const result = await response.json();
// {
//   "success": true,
//   "payment_id": "550e8400-e29b-41d4-a716-446655440000",
//   "action": "captured_full",
//   "new_status": "pagato"
// }
```

**What happens:**
1. Calls stripe.paymentIntents.capture()
2. Stripe charges full amount (€500)
3. Updates tenant_payments:
   - stato = 'pagato'
   - preauth_captured_amount = 500.00
   - payment_date = now

**Guest card:**
- €500 charge appears on statement
- Funds settle in 1-2 business days

---

## Example 7: Capture Partial Preauth (Minor Damage)

If damage is €150, capture only that amount and release the rest.

**Admin calls:**
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/stripe-manage-preauth`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      payment_id: "550e8400-e29b-41d4-a716-446655440000",
      action: "capture_partial",
      amount: 150.00, // Damage cost
    }),
  }
);

const result = await response.json();
// {
//   "success": true,
//   "payment_id": "550e8400-e29b-41d4-a716-446655440000",
//   "action": "captured_partial",
//   "new_status": "pre_autorizzato"
// }
```

**What happens:**
1. Validates amount <= payment amount
2. Calls stripe.paymentIntents.capture with amount_to_capture = 15000 (centesimi)
3. Stripe charges €150, releases hold on remaining €350
4. Updates tenant_payments:
   - preauth_captured_amount = 150.00

**Guest card:**
- €150 charge appears
- €350 authorization is released
- Partial refund takes 5-7 business days

---

## Example 8: Handle Refund (Guest Initiates Dispute)

Guest disputes charge or requests refund through Stripe Dashboard.

**Stripe webhook event:**
```json
{
  "type": "charge.refunded",
  "data": {
    "object": {
      "id": "ch_test_...",
      "payment_intent": "pi_test_...",
      "amount_refunded": 30000
    }
  }
}
```

**Your function webhook handler:**
1. Looks up payment_id by stripe_payment_intent_id
2. Updates tenant_payments:
   - stato = 'rimborsato'

**Database result:**
```sql
SELECT id, tipo, importo, stato FROM tenant_payments
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- stato: 'rimborsato'
```

**Guest account:**
- Refund appears in 5-7 business days
- Record kept for compliance

---

## Example 9: Query Payment Status

Admin dashboard checks all booking payments.

```typescript
const { data, error } = await supabase
  .from('tenant_payments')
  .select('id, booking_id, tipo, importo, stato, payment_date, data_scadenza')
  .eq('booking_id', '660e8400-e29b-41d4-a716-446655440000')
  .order('data_scadenza');

// [
//   {
//     "id": "550e8400-e29b-41d4-a716-446655440000",
//     "booking_id": "660e8400-e29b-41d4-a716-446655440000",
//     "tipo": "caparra",
//     "importo": "300.00",
//     "stato": "pagato",
//     "payment_date": "2026-03-19T14:23:45+00",
//     "data_scadenza": "2026-03-26"
//   },
//   {
//     "tipo": "saldo",
//     "stato": "da_pagare",
//     "data_scadenza": "2026-03-26"
//   },
//   // ...
// ]
```

---

## Example 10: Bulk Payment Schedule Generation

Generate payment schedules for multiple bookings (admin batch operation).

```typescript
const bookingIds = [
  "550e8400-e29b-41d4-a716-446655440000",
  "660e8400-e29b-41d4-a716-446655440000",
  "770e8400-e29b-41d4-a716-446655440000",
];

const results = await Promise.allSettled(
  bookingIds.map((bookingId) =>
    fetch(`${supabaseUrl}/functions/v1/generate-payment-schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ booking_id: bookingId }),
    }).then((r) => r.json())
  )
);

// Check results
results.forEach((result, idx) => {
  if (result.status === "fulfilled") {
    console.log(
      `Booking ${bookingIds[idx]}: ${result.value.payments_generated} payments created`
    );
  } else {
    console.error(`Booking ${bookingIds[idx]}: ${result.reason.message}`);
  }
});
```

---

## Error Scenarios

### Missing booking_id
```bash
curl -X POST http://localhost:54321/functions/v1/generate-payment-schedule \
  -H "Content-Type: application/json" \
  -d '{}'

# Response: 400 Bad Request
# {
//   "error": "booking_id is required"
// }
```

### Booking not found
```json
{
  "error": "Booking not found: unknown"
}
```

### Stripe session creation fails
```json
{
  "error": "Your card was declined"
}
```

### Preauth capture with invalid amount
```json
{
  "error": "Partial capture amount cannot exceed payment amount"
}
```

---

## Database Queries for Admin Dashboard

### Revenue Summary
```sql
SELECT
  DATE_TRUNC('month', payment_date) AS month,
  SUM(importo) AS total_revenue,
  COUNT(*) AS payment_count
FROM tenant_payments
WHERE stato = 'pagato' AND payment_date IS NOT NULL
GROUP BY DATE_TRUNC('month', payment_date)
ORDER BY month DESC;
```

### Outstanding Payments
```sql
SELECT
  tp.id,
  b.nome_ospite,
  tp.tipo,
  tp.importo,
  tp.data_scadenza,
  CURRENT_DATE - tp.data_scadenza AS days_overdue
FROM tenant_payments tp
JOIN bookings b ON b.id = tp.booking_id
WHERE tp.stato = 'da_pagare' AND tp.data_scadenza < CURRENT_DATE
ORDER BY days_overdue DESC;
```

### Preauth Status
```sql
SELECT
  id,
  importo,
  preauth_captured_amount,
  (importo - COALESCE(preauth_captured_amount, 0)) AS remaining_hold
FROM tenant_payments
WHERE is_preauth = true AND stato = 'pre_autorizzato';
```
