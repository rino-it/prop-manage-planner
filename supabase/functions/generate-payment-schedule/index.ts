import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function calculateDaysDifference(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.floor(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
}

async function generatePaymentSchedule(
  supabase: ReturnType<typeof createClient>,
  bookingId: string,
  stripeKey: string | null
) {
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, property_id, user_id, data_inizio, data_fine, numero_ospiti, importo_totale"
    )
    .eq("id", bookingId)
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
    .select(
      "caparra_percentage, caparra_due_days, saldo_due_days_before, cauzione_amount, cauzione_preauth_days_before, tassa_soggiorno_per_night, tassa_soggiorno_per_person, stripe_configured"
    )
    .eq("property_id", booking.property_id)
    .maybeSingle();

  if (settingsError && settingsError.code !== "PGRST116") {
    throw new Error(`Error fetching payment settings: ${settingsError.message}`);
  }

  const defaultSettings = {
    caparra_percentage: 30,
    caparra_due_days: 7,
    saldo_due_days_before: 14,
    cauzione_amount: 500,
    cauzione_preauth_days_before: 7,
    tassa_soggiorno_per_night: 3,
    tassa_soggiorno_per_person: true,
    stripe_configured: false,
  };

  const settings = paymentSettings || defaultSettings;
  const nights = calculateDaysDifference(
    booking.data_inizio,
    booking.data_fine
  );
  const totalAmount = booking.importo_totale || 0;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const caparra = (totalAmount * settings.caparra_percentage) / 100;
  const saldo = totalAmount - caparra;
  const tassoAmount =
    settings.tassa_soggiorno_per_night *
    nights *
    (settings.tassa_soggiorno_per_person ? booking.numero_ospiti || 1 : 1);

  const caparra_due = new Date(today);
  caparra_due.setDate(caparra_due.getDate() + settings.caparra_due_days);

  const saldo_due = new Date(booking.data_inizio);
  saldo_due.setDate(
    saldo_due.getDate() - settings.saldo_due_days_before
  );

  const cauzione_due = new Date(booking.data_inizio);
  cauzione_due.setDate(
    cauzione_due.getDate() - settings.cauzione_preauth_days_before
  );

  const checkinDate = new Date(booking.data_inizio);

  const paymentsToInsert = [
    {
      booking_id: bookingId,
      tipo: "caparra",
      importo: caparra,
      data_scadenza: caparra_due.toISOString().split("T")[0],
      stato: "da_pagare",
      is_preauth: false,
    },
    {
      booking_id: bookingId,
      tipo: "saldo",
      importo: saldo,
      data_scadenza: saldo_due.toISOString().split("T")[0],
      stato: "da_pagare",
      is_preauth: false,
    },
    {
      booking_id: bookingId,
      tipo: "cauzione",
      importo: settings.cauzione_amount,
      data_scadenza: cauzione_due.toISOString().split("T")[0],
      stato: "da_pagare",
      is_preauth: true,
    },
    {
      booking_id: bookingId,
      tipo: "tassa_soggiorno",
      importo: tassoAmount,
      data_scadenza: checkinDate.toISOString().split("T")[0],
      stato: "da_pagare",
      is_preauth: false,
    },
  ];

  const { data: insertedPayments, error: insertError } = await supabase
    .from("tenant_payments")
    .insert(paymentsToInsert)
    .select("id");

  if (insertError) {
    throw new Error(
      `Error inserting tenant payments: ${insertError.message}`
    );
  }

  if (settings.stripe_configured && insertedPayments) {
    const stripeCreateUrl =
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/stripe-create-checkout`.replace(
        "https://",
        ""
      );

    for (const payment of insertedPayments) {
      try {
        const checkoutResponse = await fetch(
          `https://${stripeCreateUrl}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              payment_id: payment.id,
            }),
          }
        );

        if (!checkoutResponse.ok) {
          console.error(
            `Failed to create Stripe checkout for payment ${payment.id}`
          );
        }
      } catch (err) {
        console.error(`Error invoking stripe-create-checkout: ${err}`);
      }
    }
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ payment_schedule_generated: true })
    .eq("id", bookingId);

  if (updateError) {
    console.error(`Warning: Could not update booking status: ${updateError}`);
  }

  return {
    success: true,
    booking_id: bookingId,
    payments_generated: insertedPayments?.length || 0,
    nights,
    caparra_due: caparra_due.toISOString().split("T")[0],
    saldo_due: saldo_due.toISOString().split("T")[0],
    cauzione_due: cauzione_due.toISOString().split("T")[0],
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

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: "booking_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await generatePaymentSchedule(supabase, booking_id, stripeKey);

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
