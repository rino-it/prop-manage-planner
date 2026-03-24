import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY") || "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DigestData {
  payments_due: { id: string; tipo: string; importo: number; data_scadenza: string; guest_name: string; property_name: string }[];
  stale_tickets: { id: string; titolo: string; stato: string; created_at: string; property_name: string; days_open: number }[];
  upcoming_bookings: { id: string; nome_ospite: string; data_inizio: string; data_fine: string; property_name: string; documents_approved: boolean }[];
  pending_documents: { booking_id: string; guest_name: string; property_name: string }[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    if (token !== supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const sendWhatsApp = body.send_whatsapp === true;
    const sendEmail = body.send_email !== false;

    const digestData = await collectDigestData(supabase);
    const hasContent =
      digestData.payments_due.length > 0 ||
      digestData.stale_tickets.length > 0 ||
      digestData.upcoming_bookings.length > 0 ||
      digestData.pending_documents.length > 0;

    if (!hasContent) {
      return new Response(
        JSON.stringify({ success: true, message: "Nessun elemento rilevante per il digest di oggi.", sent: false }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const digestText = await formatDigestWithGemini(digestData);

    const results: { email?: boolean; whatsapp?: boolean } = {};

    if (sendEmail) {
      results.email = await sendDigestEmail(supabase, digestText, digestData);
    }

    if (sendWhatsApp) {
      results.whatsapp = await sendDigestWhatsApp(supabase, digestText);
    }

    await supabase.from("ai_digest_log").insert({
      digest_text: digestText,
      payments_count: digestData.payments_due.length,
      tickets_count: digestData.stale_tickets.length,
      bookings_count: digestData.upcoming_bookings.length,
      documents_count: digestData.pending_documents.length,
      sent_email: results.email || false,
      sent_whatsapp: results.whatsapp || false,
    });

    return new Response(
      JSON.stringify({
        success: true,
        digest: digestText,
        counts: {
          payments: digestData.payments_due.length,
          stale_tickets: digestData.stale_tickets.length,
          upcoming_bookings: digestData.upcoming_bookings.length,
          pending_documents: digestData.pending_documents.length,
        },
        delivery: results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI digest error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function collectDigestData(supabase: ReturnType<typeof createClient>): Promise<DigestData> {
  const today = new Date().toISOString().split("T")[0];
  const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split("T")[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: payments } = await supabase
    .from("tenant_payments")
    .select(`
      id, tipo, importo, data_scadenza,
      bookings (nome_ospite, properties_real (nome))
    `)
    .neq("stato", "pagato")
    .neq("stato", "rimborsato")
    .lte("data_scadenza", in48h)
    .gte("data_scadenza", today)
    .order("data_scadenza", { ascending: true });

  const paymentsDue = (payments || []).map((p: any) => ({
    id: p.id,
    tipo: p.tipo,
    importo: p.importo,
    data_scadenza: p.data_scadenza,
    guest_name: p.bookings?.nome_ospite || "N/A",
    property_name: p.bookings?.properties_real?.nome || "N/A",
  }));

  const { data: tickets } = await supabase
    .from("tickets")
    .select(`
      id, titolo, stato, created_at,
      properties_real (nome)
    `)
    .in("stato", ["aperto", "in_attesa"])
    .lte("created_at", threeDaysAgo + "T23:59:59")
    .order("created_at", { ascending: true });

  const staleTickets = (tickets || []).map((t: any) => {
    const createdDate = new Date(t.created_at);
    const daysOpen = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: t.id,
      titolo: t.titolo,
      stato: t.stato,
      created_at: t.created_at,
      property_name: t.properties_real?.nome || "N/A",
      days_open: daysOpen,
    };
  });

  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      id, nome_ospite, data_inizio, data_fine, documents_approved,
      properties_real (nome)
    `)
    .gte("data_inizio", today)
    .lte("data_inizio", in48h)
    .order("data_inizio", { ascending: true });

  const upcomingBookings = (bookings || []).map((b: any) => ({
    id: b.id,
    nome_ospite: b.nome_ospite,
    data_inizio: b.data_inizio,
    data_fine: b.data_fine,
    property_name: b.properties_real?.nome || "N/A",
    documents_approved: b.documents_approved || false,
  }));

  const { data: pendingDocs } = await supabase
    .from("bookings")
    .select(`
      id, nome_ospite,
      properties_real (nome)
    `)
    .eq("documents_approved", false)
    .gte("data_fine", today);

  const pendingDocuments = (pendingDocs || []).map((d: any) => ({
    booking_id: d.id,
    guest_name: d.nome_ospite,
    property_name: d.properties_real?.nome || "N/A",
  }));

  return {
    payments_due: paymentsDue,
    stale_tickets: staleTickets,
    upcoming_bookings: upcomingBookings,
    pending_documents: pendingDocuments,
  };
}

async function formatDigestWithGemini(data: DigestData): Promise<string> {
  if (!GOOGLE_API_KEY) {
    return formatDigestFallback(data);
  }

  const prompt = `Sei l'assistente di gestione immobiliare PropManage. Genera un digest giornaliero chiaro e prioritizzato per il proprietario.

Dati di oggi:

PAGAMENTI IN SCADENZA (${data.payments_due.length}):
${data.payments_due.length > 0 ? data.payments_due.map(p => `- ${p.guest_name} | ${p.property_name} | ${p.tipo}: EUR ${p.importo} | scade: ${p.data_scadenza}`).join("\n") : "Nessuno"}

TICKET APERTI DA >3 GIORNI (${data.stale_tickets.length}):
${data.stale_tickets.length > 0 ? data.stale_tickets.map(t => `- "${t.titolo}" | ${t.property_name} | aperto da ${t.days_open} giorni | stato: ${t.stato}`).join("\n") : "Nessuno"}

ARRIVI PROSSIME 48H (${data.upcoming_bookings.length}):
${data.upcoming_bookings.length > 0 ? data.upcoming_bookings.map(b => `- ${b.nome_ospite} | ${b.property_name} | check-in: ${b.data_inizio} | documenti: ${b.documents_approved ? "OK" : "MANCANTI"}`).join("\n") : "Nessuno"}

DOCUMENTI IN ATTESA (${data.pending_documents.length}):
${data.pending_documents.length > 0 ? data.pending_documents.map(d => `- ${d.guest_name} | ${d.property_name}`).join("\n") : "Nessuno"}

Regole:
- Scrivi in italiano, tono professionale ma diretto
- Metti prima le urgenze (pagamenti scaduti, documenti mancanti per arrivi imminenti)
- Max 500 caratteri per il riassunto WhatsApp
- Formatta con sezioni chiare usando intestazioni semplici
- Se non ci sono elementi critici, dillo brevemente
- NON inventare dati, usa SOLO quelli forniti sopra`;

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      console.error(`Gemini API error: ${response.status}`);
      return formatDigestFallback(data);
    }

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || formatDigestFallback(data);
  } catch (err) {
    console.error("Gemini digest error:", err);
    return formatDigestFallback(data);
  }
}

function formatDigestFallback(data: DigestData): string {
  const lines: string[] = [];
  lines.push(`DIGEST GIORNALIERO - ${new Date().toLocaleDateString("it-IT")}`);
  lines.push("");

  if (data.payments_due.length > 0) {
    lines.push(`PAGAMENTI IN SCADENZA: ${data.payments_due.length}`);
    for (const p of data.payments_due) {
      lines.push(`  - ${p.guest_name} (${p.property_name}): EUR ${p.importo} - ${p.tipo} scade ${p.data_scadenza}`);
    }
    lines.push("");
  }

  if (data.stale_tickets.length > 0) {
    lines.push(`TICKET DA GESTIRE: ${data.stale_tickets.length}`);
    for (const t of data.stale_tickets) {
      lines.push(`  - "${t.titolo}" (${t.property_name}) - aperto da ${t.days_open}gg`);
    }
    lines.push("");
  }

  if (data.upcoming_bookings.length > 0) {
    lines.push(`ARRIVI PROSSIME 48H: ${data.upcoming_bookings.length}`);
    for (const b of data.upcoming_bookings) {
      const docStatus = b.documents_approved ? "Documenti OK" : "DOCUMENTI MANCANTI";
      lines.push(`  - ${b.nome_ospite} (${b.property_name}) check-in ${b.data_inizio} [${docStatus}]`);
    }
    lines.push("");
  }

  if (data.pending_documents.length > 0) {
    lines.push(`DOCUMENTI IN ATTESA: ${data.pending_documents.length}`);
    for (const d of data.pending_documents) {
      lines.push(`  - ${d.guest_name} (${d.property_name})`);
    }
  }

  if (lines.length <= 2) {
    lines.push("Nessun elemento critico oggi. Tutto sotto controllo.");
  }

  return lines.join("\n");
}

async function sendDigestEmail(
  supabase: ReturnType<typeof createClient>,
  digestText: string,
  data: DigestData
): Promise<boolean> {
  const functionUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") + "/functions/v1/send-email";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("email")
    .limit(1)
    .single();

  if (!profiles?.email) {
    console.error("Nessun profilo proprietario trovato per invio digest email");
    return false;
  }

  const urgentItems: string[] = [];
  if (data.payments_due.length > 0) urgentItems.push(`${data.payments_due.length} pagamenti in scadenza`);
  if (data.stale_tickets.length > 0) urgentItems.push(`${data.stale_tickets.length} ticket da gestire`);
  if (data.upcoming_bookings.some(b => !b.documents_approved)) urgentItems.push("Arrivi con documenti mancanti");

  const subject = urgentItems.length > 0
    ? `PropManage Digest: ${urgentItems.join(", ")}`
    : `PropManage Digest - ${new Date().toLocaleDateString("it-IT")}`;

  const htmlBody = digestText
    .split("\n")
    .map(line => {
      if (line.match(/^[A-Z ]+:/)) return `<h3 style="color: #333; margin-top: 16px;">${line}</h3>`;
      if (line.startsWith("  -")) return `<p style="color: #555; margin: 4px 0 4px 16px;">${line.trim()}</p>`;
      if (line.startsWith("DIGEST")) return `<h2 style="color: #2196F3;">${line}</h2>`;
      return `<p style="color: #666;">${line}</p>`;
    })
    .join("\n");

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">PropManage Digest</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">${new Date().toLocaleDateString("it-IT", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>
      <div style="background: white; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        ${htmlBody}
      </div>
      <div style="text-align: center; padding: 16px; font-size: 12px; color: #999;">
        <p>PropManage - Digest giornaliero automatico</p>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "noreply@propmanagelync.com",
        to: profiles.email,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Digest email error:", err);
      return false;
    }

    await supabase.from("email_log").insert({
      email_to: profiles.email,
      template_type: "digest",
      status: "sent",
      created_at: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    console.error("Send digest email error:", err);
    return false;
  }
}

async function sendDigestWhatsApp(
  supabase: ReturnType<typeof createClient>,
  digestText: string
): Promise<boolean> {
  const { data: config } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("enabled", true)
    .limit(1)
    .single();

  if (!config?.owner_whatsapp || !config?.phone_number_id) {
    console.error("WhatsApp config non trovata o incompleta per digest");
    return false;
  }

  const accessToken = config.access_token || WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) return false;

  const truncatedDigest = digestText.length > 1500
    ? digestText.substring(0, 1497) + "..."
    : digestText;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: config.owner_whatsapp,
          type: "text",
          text: { body: truncatedDigest },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Digest WhatsApp error:", err);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Send digest WhatsApp error:", err);
    return false;
  }
}
