import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

async function handleWebhook(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  event: Stripe.Event
) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.payment_id;

      if (!paymentId) {
        throw new Error("Payment ID not found in metadata");
      }

      const { error: updateError } = await supabase
        .from("tenant_payments")
        .update({
          stato: "pagato",
          payment_date: new Date().toISOString(),
          receipt_url: session.payment_intent
            ? `https://dashboard.stripe.com/payments/${session.payment_intent}`
            : null,
        })
        .eq("id", paymentId);

      if (updateError) {
        throw new Error(
          `Error updating payment status: ${updateError.message}`
        );
      }

      return { processed: true, event_type: "checkout.session.completed" };
    }

    case "payment_intent.amount_capturable_updated": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const paymentId = paymentIntent.metadata?.payment_id;

      if (!paymentId) {
        throw new Error("Payment ID not found in metadata");
      }

      const { error: updateError } = await supabase
        .from("tenant_payments")
        .update({
          stato: "pre_autorizzato",
        })
        .eq("id", paymentId);

      if (updateError) {
        throw new Error(
          `Error updating payment preauth status: ${updateError.message}`
        );
      }

      return {
        processed: true,
        event_type: "payment_intent.amount_capturable_updated",
      };
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string | null;

      if (!paymentIntentId) {
        throw new Error("Payment Intent ID not found");
      }

      const { data: payments, error: queryError } = await supabase
        .from("tenant_payments")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntentId);

      if (queryError) {
        throw new Error(`Error querying payments: ${queryError.message}`);
      }

      if (payments && payments.length > 0) {
        const { error: updateError } = await supabase
          .from("tenant_payments")
          .update({
            stato: "rimborsato",
          })
          .eq("id", payments[0].id);

        if (updateError) {
          throw new Error(
            `Error updating refund status: ${updateError.message}`
          );
        }
      }

      return { processed: true, event_type: "charge.refunded" };
    }

    default:
      return { processed: false, event_type: event.type };
  }
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!supabaseUrl || !supabaseServiceKey || !stripeKey || !webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Missing configuration" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey);

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    const result = await handleWebhook(supabase, stripe, event);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown webhook error";
    console.error(`Webhook error: ${message}`);

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
