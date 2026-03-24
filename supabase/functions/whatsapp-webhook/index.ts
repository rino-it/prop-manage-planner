import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "";
const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") || "";

serve(async (req: Request) => {
  // GET: Meta webhook verification (challenge handshake)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verification successful");
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  // POST: Messaggi in arrivo da Meta
  if (req.method === "POST") {
    const body = await req.text();

    // Validazione firma x-hub-signature-256 (requisito Meta)
    if (APP_SECRET) {
      const signature = req.headers.get("x-hub-signature-256");
      if (signature) {
        const expectedSignature =
          "sha256=" + hmac("sha256", APP_SECRET, body, "utf8", "hex");
        if (signature !== expectedSignature) {
          console.error("Invalid webhook signature");
          return new Response("Invalid signature", { status: 401 });
        }
      }
    }

    // Risposta immediata HTTP 200 (requisito Meta: entro 5 secondi)
    // Il processing avviene in modo asincrono chiamando whatsapp-process-ticket
    const payload = JSON.parse(body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Estrai messaggi dal payload Meta Cloud API
    const entries = payload?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        if (change.field !== "messages") continue;

        const messages = change.value?.messages || [];
        const contacts = change.value?.contacts || [];
        const metadata = change.value?.metadata || {};

        for (const message of messages) {
          if (message.type !== "text") continue;

          const fromNumber = message.from;
          const messageBody = message.text?.body || "";
          const waMessageId = message.id;
          const contactName =
            contacts.find(
              (c: { wa_id: string }) => c.wa_id === fromNumber
            )?.profile?.name || "";
          const phoneNumberId = metadata.phone_number_id || "";

          // Log messaggio in arrivo
          const { error: logError } = await supabase
            .from("whatsapp_messages")
            .insert({
              direction: "inbound",
              wa_message_id: waMessageId,
              from_number: fromNumber,
              to_number: phoneNumberId,
              body: messageBody,
              processed: false,
            });

          if (logError) {
            console.error("Error logging WhatsApp message:", logError.message);
          }

          // Chiama Edge Function di processing in modo asincrono
          // (fire-and-forget per rispettare il timeout 5s di Meta)
          const processUrl = `${supabaseUrl}/functions/v1/whatsapp-process-ticket`;
          fetch(processUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from_number: fromNumber,
              message_body: messageBody,
              wa_message_id: waMessageId,
              contact_name: contactName,
              phone_number_id: phoneNumberId,
            }),
          }).catch((err) =>
            console.error("Error calling process-ticket:", err.message)
          );
        }
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
});
