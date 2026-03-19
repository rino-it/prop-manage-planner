import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ICalEvent {
  uid: string | null;
  start: string | null;
  end: string | null;
  summary: string | null;
}

interface SyncRequest {
  property_id?: string;
}

interface Property {
  id: string;
  nome: string;
  ical_url: string | null;
}

interface ExistingBooking {
  id: string;
  data_inizio: string;
  data_fine: string;
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
      const regex = new RegExp(`${name}[^:\\n]*:(.+?)(?:\\n|$)`, "i");
      const match = block.match(regex);
      return match?.[1]?.trim() || null;
    };

    const uid = getField("UID");
    const dtstart = getField("DTSTART");
    const dtend = getField("DTEND");
    const summary = getField("SUMMARY");

    const start = parseIcalDate(dtstart);
    const end = parseIcalDate(dtend);

    if (uid && start && end && summary) {
      events.push({ uid, start, end, summary });
    }
  }

  return events;
}

function datesBetween(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1 < end2 && end1 > start2;
}

async function syncPropertyIcal(
  supabase: ReturnType<typeof createClient>,
  property: Property
): Promise<{ property_id: string; events_imported: number; events_skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let eventsImported = 0;
  let eventsSkipped = 0;

  if (!property.ical_url) {
    return { property_id: property.id, events_imported: 0, events_skipped: 0, errors: ["No iCal URL configured"] };
  }

  try {
    const iCalResponse = await fetch(property.ical_url);
    if (!iCalResponse.ok) {
      throw new Error(`Failed to fetch iCal: ${iCalResponse.statusText}`);
    }

    const iCalText = await iCalResponse.text();
    const events = parseIcal(iCalText);

    const { data: existingBookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, data_inizio, data_fine, external_uid")
      .eq("property_id", property.id);

    if (bookingsError) {
      throw new Error(`Failed to fetch existing bookings: ${bookingsError.message}`);
    }

    const externalUids = new Set(
      (existingBookings || [])
        .filter((b: { external_uid: string | null }) => b.external_uid)
        .map((b: { external_uid: string }) => b.external_uid)
    );

    for (const event of events) {
      if (externalUids.has(event.uid!)) {
        eventsSkipped++;
        continue;
      }

      const hasOverlap = (existingBookings || []).some((booking: ExistingBooking) =>
        datesBetween(event.start!, event.end!, booking.data_inizio, booking.data_fine)
      );

      if (hasOverlap) {
        eventsSkipped++;
        continue;
      }

      const { error: insertError } = await supabase.from("bookings").insert({
        property_id: property.id,
        nome_ospite: event.summary,
        data_inizio: event.start,
        data_fine: event.end,
        external_uid: event.uid,
        source: "ical_import",
        tipo_affitto: "breve",
        stato: "confermata",
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        errors.push(`Failed to import event ${event.uid}: ${insertError.message}`);
        eventsSkipped++;
      } else {
        eventsImported++;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    errors.push(message);
  }

  return { property_id: property.id, events_imported: eventsImported, events_skipped: eventsSkipped, errors };
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

    const body: SyncRequest = await req.json().catch(() => ({}));
    const propertyId = body.property_id;

    let properties: Property[] = [];

    if (propertyId) {
      const { data, error } = await supabase
        .from("properties_real")
        .select("id, nome, ical_url")
        .eq("id", propertyId)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Property not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      properties = [data];
    } else {
      const { data, error } = await supabase
        .from("properties_real")
        .select("id, nome, ical_url")
        .not("ical_url", "is", null);

      if (error) {
        throw new Error(`Failed to fetch properties: ${error.message}`);
      }

      properties = data || [];
    }

    const results = [];

    for (const property of properties) {
      const result = await syncPropertyIcal(supabase, property);
      results.push(result);

      if (result.errors.length > 0 || result.events_imported > 0 || result.events_skipped > 0) {
        const { error: logError } = await supabase.from("ical_sync_log").insert({
          property_id: property.id,
          events_imported: result.events_imported,
          events_skipped: result.events_skipped,
          errors: result.errors.length > 0 ? result.errors : null,
          synced_at: new Date().toISOString(),
        });

        if (logError) {
          console.error(`Failed to log sync for property ${property.id}:`, logError);
        }
      }
    }

    const totalImported = results.reduce((sum, r) => sum + r.events_imported, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.events_skipped, 0);

    return new Response(
      JSON.stringify({
        success: true,
        properties_synced: results.length,
        total_events_imported: totalImported,
        total_events_skipped: totalSkipped,
        results,
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
