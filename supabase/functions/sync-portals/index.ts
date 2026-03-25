import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ICalEvent {
  uid: string;
  start: string;
  end: string;
  summary: string;
}

interface PortalConnection {
  id: string;
  user_id: string;
  property_id: string;
  portal_name: string;
  connection_type: string;
  ical_url: string | null;
  status: string;
  properties_real: { id: string; nome: string } | null;
}

function parseIcalDate(raw: string | null): string | null {
  if (!raw) return null;
  const clean = raw.replace(/[TZ]/g, "").substring(0, 8);
  if (clean.length !== 8) return null;
  return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
}

function parseIcal(text: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const blocks = text.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const getField = (name: string): string | null => {
      const regex = new RegExp(`${name}[^:\\n]*:(.+?)(?:\\r?\\n|$)`, "i");
      const match = block.match(regex);
      return match?.[1]?.trim() || null;
    };

    const uid = getField("UID");
    const dtstart = getField("DTSTART");
    const dtend = getField("DTEND");
    const summary = getField("SUMMARY");

    const start = parseIcalDate(dtstart);
    const end = parseIcalDate(dtend);

    if (uid && start && end) {
      events.push({ uid, start, end, summary: summary || "Prenotazione esterna" });
    }
  }
  return events;
}

async function syncConnection(
  supabase: ReturnType<typeof createClient>,
  conn: PortalConnection
): Promise<{
  connection_id: string;
  portal_name: string;
  property_name: string;
  events_imported: number;
  events_skipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let eventsImported = 0;
  let eventsSkipped = 0;
  const propertyName = conn.properties_real?.nome || conn.property_id;

  if (conn.connection_type !== "ical" || !conn.ical_url) {
    return {
      connection_id: conn.id,
      portal_name: conn.portal_name,
      property_name: String(propertyName),
      events_imported: 0,
      events_skipped: 0,
      errors: ["No iCal URL configured"],
    };
  }

  try {
    const resp = await fetch(conn.ical_url, {
      headers: {
        "User-Agent": "PropManage/1.0 iCal-Sync",
        "Accept": "text/calendar, text/plain, */*",
      },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status}: ${resp.statusText} - ${body.substring(0, 200)}`);
    }

    const icalText = await resp.text();
    const events = parseIcal(icalText);

    const { data: existingBookings, error: bErr } = await supabase
      .from("bookings")
      .select("id, data_inizio, data_fine, external_uid")
      .eq("property_id", conn.property_id);

    if (bErr) throw new Error(`Fetch bookings failed: ${bErr.message}`);

    const externalUids = new Set(
      (existingBookings || [])
        .filter((b: { external_uid: string | null }) => b.external_uid)
        .map((b: { external_uid: string }) => b.external_uid)
    );

    for (const event of events) {
      if (externalUids.has(event.uid)) {
        eventsSkipped++;
        continue;
      }

      const hasOverlap = (existingBookings || []).some(
        (b: { data_inizio: string; data_fine: string }) =>
          event.start < b.data_fine && event.end > b.data_inizio
      );

      if (hasOverlap) {
        eventsSkipped++;
        continue;
      }

      const { error: insertErr } = await supabase.from("bookings").insert({
        property_id: conn.property_id,
        user_id: conn.user_id,
        nome_ospite: event.summary,
        data_inizio: event.start,
        data_fine: event.end,
        external_uid: event.uid,
        source: `${conn.portal_name}_ical`,
        tipo_affitto: "breve",
        checkin_status: "pending",
      });

      if (insertErr) {
        errors.push(`Import ${event.uid}: ${insertErr.message}`);
        eventsSkipped++;
      } else {
        eventsImported++;
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unknown error");
  }

  const syncResult = {
    events_imported: eventsImported,
    events_skipped: eventsSkipped,
    errors: errors.length > 0 ? errors : null,
    synced_at: new Date().toISOString(),
  };

  await supabase
    .from("portal_connections")
    .update({
      last_sync: new Date().toISOString(),
      last_sync_result: syncResult,
      status: errors.length > 0 && eventsImported === 0 ? "error" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  return {
    connection_id: conn.id,
    portal_name: conn.portal_name,
    property_name: String(propertyName),
    events_imported: eventsImported,
    events_skipped: eventsSkipped,
    errors,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase config");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const connectionId = body.connection_id;
    const propertyId = body.property_id;

    let query = supabase
      .from("portal_connections")
      .select("*, properties_real(id, nome)")
      .eq("status", "active")
      .eq("connection_type", "ical");

    if (connectionId) {
      query = supabase
        .from("portal_connections")
        .select("*, properties_real(id, nome)")
        .eq("id", connectionId);
    } else if (propertyId) {
      query = supabase
        .from("portal_connections")
        .select("*, properties_real(id, nome)")
        .eq("property_id", propertyId)
        .eq("status", "active");
    }

    const { data: connections, error: connErr } = await query;
    if (connErr) throw new Error(`Fetch connections: ${connErr.message}`);

    const results = [];
    for (const conn of connections || []) {
      const result = await syncConnection(supabase, conn as PortalConnection);
      results.push(result);
    }

    const totalImported = results.reduce((s, r) => s + r.events_imported, 0);
    const totalSkipped = results.reduce((s, r) => s + r.events_skipped, 0);

    return new Response(
      JSON.stringify({
        success: true,
        connections_synced: results.length,
        total_events_imported: totalImported,
        total_events_skipped: totalSkipped,
        results,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
