import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function managePreauth(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  paymentId: string,
  action: string,
  amount?: number
) {
  const { data: payment, error: paymentError } = await supabase
    .from("tenant_payments")
    .select(
      "id, stripe_payment_intent_id, importo, stato"
    )
    .eq("id", paymentId)
    .single();

  if (paymentError || !payment) {
    throw new Error(`Payment not found: ${paymentError?.message || "unknown"}`);
  }

  if (!payment.stripe_payment_intent_id) {
    throw new Error("Payment has no associated Stripe Payment Intent");
  }

  let updatePayload: Record<string, unknown> = {};
  let stripeAction: string = "";

  if (action === "release") {
    await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id);
    updatePayload = {
      stato: "rilasciato",
      preauth_released: true,
    };
    stripeAction = "released";
  } else if (action === "capture_full") {
    const captured = await stripe.paymentIntents.capture(
      payment.stripe_payment_intent_id
    );

    updatePayload = {
      stato: "pagato",
      preauth_captured_amount: payment.importo,
      payment_date: new Date().toISOString(),
    };
    stripeAction = "captured_full";
  } else if (action === "capture_partial") {
    if (!amount || amount <= 0) {
      throw new Error("Amount is required for partial capture");
    }

    if (amount > payment.importo) {
      throw new Error("Partial capture amount cannot exceed payment amount");
    }

    await stripe.paymentIntents.capture(payment.stripe_payment_intent_id, {
      amount_to_capture: Math.round(amount * 100),
    });

    updatePayload = {
      preauth_captured_amount: amount,
    };
    stripeAction = "captured_partial";
  } else {
    throw new Error(
      "Invalid action. Must be 'release', 'capture_full', or 'capture_partial'"
    );
  }

  const { error: updateError } = await supabase
    .from("tenant_payments")
    .update(updatePayload)
    .eq("id", paymentId);

  if (updateError) {
    throw new Error(`Error updating payment: ${updateError.message}`);
  }

  return {
    success: true,
    payment_id: paymentId,
    action: stripeAction,
    new_status: updatePayload.stato || payment.stato,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !stripeKey) {
      throw new Error("Missing Supabase or Stripe configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey);

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { payment_id, action, amount } = await req.json();

    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: "payment_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!action) {
      return new Response(
        JSON.stringify({
          error: "action is required (release, capture_full, or capture_partial)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await managePreauth(supabase, stripe, payment_id, action, amount);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
