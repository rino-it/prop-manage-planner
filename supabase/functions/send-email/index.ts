import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailPayment {
  type: string;
  amount: number;
  due_date: string;
  checkout_url?: string;
}

interface TemplateData {
  guest_name: string;
  property_name: string;
  brand_logo_url?: string;
  brand_color?: string;
  payments?: EmailPayment[];
  payment_amount?: number;
  payment_type?: string;
  payment_date?: string;
  receipt_url?: string;
  days_until_due?: number;
  checkout_url?: string;
  keybox_code?: string;
  wifi_ssid?: string;
  wifi_password?: string;
  address?: string;
  maps_url?: string;
  checkin_video_url?: string;
  doc_status?: string;
  portal_url?: string;
  booking_id?: string;
}

interface SendEmailRequest {
  to: string;
  template_type: "welcome" | "payment_reminder" | "payment_confirmation" | "checkin_instructions" | "document_status";
  template_data: TemplateData;
}

function buildEmailHtml(templateType: string, data: TemplateData): { subject: string; html: string } {
  const bgColor = data.brand_color || "#ffffff";
  const logoHtml = data.brand_logo_url
    ? `<img src="${data.brand_logo_url}" alt="Logo" style="max-width: 200px; height: auto; margin-bottom: 20px;" />`
    : "";

  const headerHtml = `
    <div style="background-color: ${bgColor}; padding: 40px 20px; text-align: center;">
      ${logoHtml}
      <h1 style="color: #333; margin: 20px 0; font-size: 24px;">${data.property_name}</h1>
    </div>
  `;

  const footerHtml = `
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; margin-top: 30px;">
      <p>${data.property_name}</p>
      <p style="margin: 5px 0;">Per informazioni, rispondi a questa email</p>
    </div>
  `;

  let bodyHtml = "";
  let subject = "";

  if (templateType === "welcome") {
    subject = `Prenotazione confermata - ${data.property_name}`;
    const paymentTableRows = (data.payments || [])
      .map(
        (p) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${p.type}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">€${p.amount.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${p.due_date}</td>
      </tr>
    `
      )
      .join("");

    bodyHtml = `
      <div style="padding: 40px 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Ciao ${data.guest_name}!</h2>
        <p style="color: #666; font-size: 14px;">La tua prenotazione è confermata. Qui di seguito trovi i dettagli dei pagamenti.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 10px; text-align: left; font-weight: bold;">Tipo</th>
              <th style="padding: 10px; text-align: right; font-weight: bold;">Importo</th>
              <th style="padding: 10px; font-weight: bold;">Scadenza</th>
            </tr>
          </thead>
          <tbody>
            ${paymentTableRows}
          </tbody>
        </table>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.checkout_url || '#'}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">Paga Caparra</a>
        </div>
      </div>
    `;
  } else if (templateType === "payment_reminder") {
    subject = `Pagamento in scadenza - ${data.property_name}`;
    bodyHtml = `
      <div style="padding: 40px 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Scadenza tra ${data.days_until_due} giorni</h2>
        <p style="color: #666; font-size: 14px;">Ti ricordiamo che il pagamento di <strong>€${data.payment_amount?.toFixed(2)}</strong> (${data.payment_type}) scade presto.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.checkout_url || '#'}" style="display: inline-block; background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">Paga Ora</a>
        </div>
      </div>
    `;
  } else if (templateType === "payment_confirmation") {
    subject = `Pagamento ricevuto - ${data.property_name}`;
    bodyHtml = `
      <div style="padding: 40px 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Pagamento ricevuto</h2>
        <p style="color: #666; font-size: 14px;">Abbiamo ricevuto il tuo pagamento di <strong>€${data.payment_amount?.toFixed(2)}</strong>.</p>
        <p style="color: #666; font-size: 14px;">Data: ${data.payment_date}</p>

        ${data.receipt_url ? `<div style="text-align: center; margin: 30px 0;"><a href="${data.receipt_url}" style="color: #2196F3; text-decoration: none;">Visualizza ricevuta</a></div>` : ""}
      </div>
    `;
  } else if (templateType === "checkin_instructions") {
    subject = `Istruzioni per il check-in - ${data.property_name}`;
    bodyHtml = `
      <div style="padding: 40px 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Benvenuto ${data.guest_name}!</h2>

        ${data.keybox_code ? `<div style="background-color: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 4px;"><strong>Codice cassaforte:</strong> <span style="font-size: 18px; font-weight: bold; color: #2196F3;">${data.keybox_code}</span></div>` : ""}

        ${data.wifi_ssid ? `<div style="background-color: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 4px;"><strong>WiFi:</strong> ${data.wifi_ssid}<br /><strong>Password:</strong> ${data.wifi_password}</div>` : ""}

        ${data.address ? `<div style="margin: 20px 0;"><strong>Indirizzo:</strong> ${data.address}</div>` : ""}

        ${data.maps_url ? `<div style="text-align: center; margin: 30px 0;"><a href="${data.maps_url}" style="color: #2196F3; text-decoration: none;">Apri su Google Maps</a></div>` : ""}

        ${data.checkin_video_url ? `<div style="text-align: center; margin: 30px 0;"><a href="${data.checkin_video_url}" style="display: inline-block; background-color: #FF6B35; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">Guarda il video</a></div>` : ""}
      </div>
    `;
  } else if (templateType === "document_status") {
    subject = `Stato documenti - ${data.property_name}`;
    bodyHtml = `
      <div style="padding: 40px 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Stato documenti</h2>
        <p style="color: #666; font-size: 14px;">I tuoi documenti sono stati <strong>${data.doc_status}</strong>.</p>

        ${data.portal_url ? `<div style="text-align: center; margin: 30px 0;"><a href="${data.portal_url}" style="display: inline-block; background-color: #9C27B0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">Vai al portale</a></div>` : ""}
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #333; }
        a { color: #2196F3; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
      </style>
    </head>
    <body>
      <div class="container">
        ${headerHtml}
        ${bodyHtml}
        ${footerHtml}
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

async function sendEmail(
  supabase: ReturnType<typeof createClient>,
  to: string,
  templateType: string,
  templateData: TemplateData
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const { subject, html } = buildEmailHtml(templateType, templateData);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "noreply@propmanagelync.com",
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
  }

  const responseData = await response.json();
  const emailId = responseData.id;

  const { error: logError } = await supabase.from("email_log").insert({
    email_to: to,
    template_type: templateType,
    email_id: emailId,
    status: "sent",
    created_at: new Date().toISOString(),
  });

  if (logError) {
    throw new Error(`Failed to log email: ${logError.message}`);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SendEmailRequest = await req.json();

    if (!body.to || !body.template_type || !body.template_data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, template_type, template_data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await sendEmail(supabase, body.to, body.template_type, body.template_data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        email: body.to,
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
