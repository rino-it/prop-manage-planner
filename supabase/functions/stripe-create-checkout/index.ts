import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function createCheckoutSession(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  paymentId: string
) {
  const { data: payment, error: paymentError } = await supabase
    .from("tenant_payments")
    .select("id, booking_id, importo, tipo, is_preauth")
    .eq("id", paymentId)
    .single();

  if (paymentError || !payment) {
    throw new Error(`Payment not found: ${paymentError?.message || "unknown"}`);
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, property_id, user_id, nome_ospite, email_ospite")
    .eq("id", payment.booking_id)
    .single();

  if (bookingError || !booking) {
    throw new Error(`Booking not found: ${bookingError?.message || "unknown"}`);
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties_real")
    .select("id")
    .eq("id", booking.property_id)
    .single();

  if (propertyError || !property) {
    throw new Error(
      `Property not found: ${propertyError?.message || "unknown"}`
    );
  }

  const { data: paymentSettings, error: settingsError } = await supabase
    .from("payment_settings")
    .select("stripe_account_id, stripe_configured")
    .eq("property_id", booking.property_id)
    .maybeSingle();

  if (settingsError && settingsError.code !== "PGRST116") {
    throw new Error(
      `Error fetching payment settings: ${settingsError.message}`
    );
  }

  const baseUrl = "https://prop-manage-planner.vercel.app";
  const successUrl = `${baseUrl}/guest/${booking.id}?payment=success`;
  const cancelUrl = `${baseUrl}/guest/${booking.id}?payment=cancelled`;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: booking.email_ospite || undefined,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `${payment.tipo} - Prenotazione ${booking.nome_ospite}`,
          },
          unit_amount: Math.round(payment.importo * 100),
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      payment_id: paymentId,
      booking_id: booking.id,
    },
    ...(payment.is_preauth && {
      payment_intent_data: {
        capture_method: "manual",
      },
    }),
  });

  const { error: updateError } = await supabase
    .from("tenant_payments")
    .update({
      stripe_session_id: checkoutSession.id,
      stripe_checkout_url: checkoutSession.url,
      stripe_payment_intent_id: checkoutSession.payment_intent,
    })
    .eq("id", paymentId);

  if (updateError) {
    throw new Error(
      `Error updating payment with Stripe info: ${updateError.message}`
    );
  }

  return {
    success: true,
    payment_id: paymentId,
    booking_id: booking.id,
    session_id: checkoutSession.id,
    checkout_url: checkoutSession.url,
    is_preauth: payment.is_preauth,
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

    const { payment_id } = await req.json();

    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: "payment_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await createCheckoutSession(supabase, stripe, payment_id);

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
