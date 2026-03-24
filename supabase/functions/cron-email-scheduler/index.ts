import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payment {
  id: string;
  booking_id: string;
  importo: number;
  tipo: string;
  data_scadenza: string;
}

interface Booking {
  id: string;
  nome_ospite: string;
  email_ospite: string;
  property_id: string;
  data_inizio: string;
}

interface Property {
  id: string;
  nome: string;
}

interface PaymentSettings {
  property_id: string;
  reminder_days_before: number;
  checkin_email_days_before: number;
}

async function sendEmailViaFunction(
  emailData: Record<string, unknown>
): Promise<void> {
  const functionUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") + "/functions/v1/send-email";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
  }
}

function getDaysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

async function processPaymentReminders(supabase: ReturnType<typeof createClient>): Promise<number> {
  const today = new Date().toISOString().split("T")[0];

  const { data: payments, error: paymentsError } = await supabase
    .from("tenant_payments")
    .select("id, booking_id, importo, tipo, data_scadenza")
    .eq("email_sent", false)
    .neq("stato", "pagato")
    .gte("data_scadenza", today)
    .lte("data_scadenza", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

  if (paymentsError) {
    throw new Error(`Error fetching payments: ${paymentsError.message}`);
  }

  if (!payments || payments.length === 0) {
    return 0;
  }

  let sentCount = 0;

  for (const payment of payments) {
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, nome_ospite, email_ospite, property_id")
      .eq("id", payment.booking_id)
      .single();

    if (bookingError || !booking) {
      continue;
    }

    const { data: paymentSettings, error: settingsError } = await supabase
      .from("payment_settings")
      .select("reminder_days_before, brand_logo_url, brand_color")
      .eq("property_id", booking.property_id)
      .maybeSingle();

    if (settingsError && settingsError.code !== "PGRST116") {
      continue;
    }

    const { data: property } = await supabase
      .from("properties_real")
      .select("nome")
      .eq("id", booking.property_id)
      .single();

    const reminderDaysBefore = paymentSettings?.reminder_days_before || 3;
    const daysUntilDue = getDaysUntilDue(payment.data_scadenza);

    if (daysUntilDue <= reminderDaysBefore && daysUntilDue >= 0) {
      try {
        await sendEmailViaFunction({
          to: booking.email_ospite,
          template_type: "payment_reminder",
          template_data: {
            guest_name: booking.nome_ospite,
            property_name: property?.nome || "Proprietà",
            payment_amount: payment.importo,
            payment_type: payment.tipo,
            days_until_due: daysUntilDue,
            checkout_url: `https://prop-manage-planner.vercel.app/guest/${booking.id}`,
            brand_logo_url: paymentSettings?.brand_logo_url,
            brand_color: paymentSettings?.brand_color,
          },
        });

        const { error: updateError } = await supabase
          .from("tenant_payments")
          .update({ email_sent: true })
          .eq("id", payment.id);

        if (!updateError) {
          sentCount++;
        }
      } catch (error) {
        console.error(`Failed to send reminder for payment ${payment.id}:`, error);
      }
    }
  }

  return sentCount;
}

async function processCheckinEmails(supabase: ReturnType<typeof createClient>): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const maxDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("id, nome_ospite, email_ospite, property_id, data_inizio")
    .eq("checkin_email_sent", false)
    .eq("documents_approved", true)
    .gte("data_inizio", today)
    .lte("data_inizio", maxDate);

  if (bookingsError) {
    throw new Error(`Error fetching bookings: ${bookingsError.message}`);
  }

  if (!bookings || bookings.length === 0) {
    return 0;
  }

  let sentCount = 0;

  for (const booking of bookings) {
    const { data: paymentSettings } = await supabase
      .from("payment_settings")
      .select("checkin_email_days_before, brand_logo_url, brand_color")
      .eq("property_id", booking.property_id)
      .maybeSingle();

    const { data: property } = await supabase
      .from("properties_real")
      .select("nome, keybox_code, wifi_ssid, wifi_password, indirizzo, maps_url, checkin_video_url")
      .eq("id", booking.property_id)
      .single();

    if (!property) continue;

    const checkinEmailDaysBefore = paymentSettings?.checkin_email_days_before || 1;
    const daysUntilCheckin = Math.ceil(
      (new Date(booking.data_inizio).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilCheckin <= checkinEmailDaysBefore && daysUntilCheckin >= 0) {
      try {
        await sendEmailViaFunction({
          to: booking.email_ospite,
          template_type: "checkin_instructions",
          template_data: {
            guest_name: booking.nome_ospite,
            property_name: property.nome,
            keybox_code: property.keybox_code,
            wifi_ssid: property.wifi_ssid,
            wifi_password: property.wifi_password,
            address: property.indirizzo,
            maps_url: property.maps_url,
            checkin_video_url: property.checkin_video_url,
            brand_logo_url: paymentSettings?.brand_logo_url,
            brand_color: paymentSettings?.brand_color,
          },
        });

        const { error: updateError } = await supabase
          .from("bookings")
          .update({ checkin_email_sent: true })
          .eq("id", booking.id);

        if (!updateError) {
          sentCount++;
        }
      } catch (error) {
        console.error(`Failed to send checkin email for booking ${booking.id}:`, error);
      }
    }
  }

  return sentCount;
}

async function triggerAiDigest(
  supabase: ReturnType<typeof createClient>
): Promise<{ sent: boolean; error?: string }> {
  const functionUrl =
    Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") + "/functions/v1/ai-digest";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!functionUrl || !serviceKey) {
    return { sent: false, error: "Missing configuration" };
  }

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      send_email: true,
      send_whatsapp: true,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    return { sent: false, error: errorData };
  }

  const result = await response.json();
  return { sent: result.success || false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    if (token !== serviceKey) {
      return new Response(JSON.stringify({ error: "Invalid authorization token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [remindersSent, checkinsSent] = await Promise.all([
      processPaymentReminders(supabase),
      processCheckinEmails(supabase),
    ]);

    let digestResult = null;
    try {
      digestResult = await triggerAiDigest(supabase);
    } catch (digestError) {
      console.error("AI digest trigger failed (non-blocking):", digestError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_reminders_sent: remindersSent,
        checkin_emails_sent: checkinsSent,
        ai_digest: digestResult,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
