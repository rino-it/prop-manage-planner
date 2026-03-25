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
  isBlocked: boolean;
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

const BLOCKED_PATTERNS = [
  /not available/i,
  /non disponibile/i,
  /closed/i,
  /blocked/i,
  /airbnb \(not available\)/i,
  /^reserved$/i,
  /bloccato/i,
];

function isBlockedEvent(summary: string): boolean {
  return BLOCKED_PATTERNS.some((p) => p.test(summary));
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
    const summary = getField("SUMMARY") || "";

    const start = parseIcalDate(dtstart);
    const end = parseIcalDate(dtend);

    if (uid && start && end) {
      events.push({
        uid,
        start,
        end,
        summary: summary || "Prenotazione esterna",
        isBlocked: isBlockedEvent(summary),
      });
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
  bookings_imported: number;
  bookings_skipped: number;
  blocks_imported: number;
  blocks_removed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let bookingsImported = 0;
  let bookingsSkipped = 0;
  let blocksImported = 0;
  let blocksRemoved = 0;
  const propertyName = conn.properties_real?.nome || conn.property_id;
  const source = `${conn.portal_name}_ical`;

  if (conn.connection_type !== "ical" || !conn.ical_url) {
    return {
      connection_id: conn.id,
      portal_name: conn.portal_name,
      property_name: String(propertyName),
      bookings_imported: 0,
      bookings_skipped: 0,
      blocks_imported: 0,
      blocks_removed: 0,
      errors: ["No iCal URL configured"],
    };
  }

  try {
    const resp = await fetch(conn.ical_url, {
      headers: {
        "User-Agent": "PropManage/1.0 iCal-Sync",
        Accept: "text/calendar, text/plain, */*",
      },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(
        `HTTP ${resp.status}: ${resp.statusText} - ${body.substring(0, 200)}`
      );
    }

    const icalText = await resp.text();

    if (!icalText.includes("BEGIN:VCALENDAR")) {
      throw new Error(
        `Response is not valid iCal (${icalText.length} bytes, starts with: ${icalText.substring(0, 80)})`
      );
    }

    const events = parseIcal(icalText);
    const bookingEvents = events.filter((e) => !e.isBlocked);
    const blockedEvents = events.filter((e) => e.isBlocked);

    // --- BOOKINGS: upsert by external_uid ---
    const { data: existingBookings, error: bErr } = await supabase
      .from("bookings")
      .select("id, data_inizio, data_fine, external_uid")
      .eq("property_id", conn.property_id)
      .eq("source", source);

    if (bErr) throw new Error(`Fetch bookings failed: ${bErr.message}`);

    const existingByUid = new Map(
      (existingBookings || [])
        .filter((b: { external_uid: string | null }) => b.external_uid)
        .map((b: { id: string; external_uid: string; data_inizio: string; data_fine: string }) => [
          b.external_uid,
          b,
        ])
    );

    const feedBookingUids = new Set<string>();

    for (const event of bookingEvents) {
      feedBookingUids.add(event.uid);
      const existing = existingByUid.get(event.uid) as
        | { id: string; data_inizio: string; data_fine: string }
        | undefined;

      if (existing) {
        if (
          existing.data_inizio !== event.start ||
          existing.data_fine !== event.end
        ) {
          const { error: updateErr } = await supabase
            .from("bookings")
            .update({
              data_inizio: event.start,
              data_fine: event.end,
              nome_ospite: event.summary,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (updateErr) {
            errors.push(`Update booking ${event.uid}: ${updateErr.message}`);
          } else {
            bookingsImported++;
          }
        } else {
          bookingsSkipped++;
        }
      } else {
        const { error: insertErr } = await supabase.from("bookings").insert({
          property_id: conn.property_id,
          user_id: conn.user_id,
          nome_ospite: event.summary,
          data_inizio: event.start,
          data_fine: event.end,
          external_uid: event.uid,
          source,
          tipo_affitto: "breve",
          checkin_status: "pending",
        });

        if (insertErr) {
          errors.push(`Import booking ${event.uid}: ${insertErr.message}`);
          bookingsSkipped++;
        } else {
          bookingsImported++;
        }
      }
    }

    // Remove bookings no longer in the feed (cancelled on portal)
    for (const [uid, booking] of existingByUid) {
      if (!feedBookingUids.has(uid as string)) {
        const b = booking as { id: string };
        await supabase.from("bookings").delete().eq("id", b.id);
      }
    }

    // --- BLOCKED DATES: full replace for this source ---
    const { data: existingBlocks, error: blErr } = await supabase
      .from("property_blocked_dates")
      .select("id, date_start, date_end, external_uid")
      .eq("property_id", conn.property_id)
      .eq("source", source);

    if (blErr) {
      errors.push(`Fetch blocked dates failed: ${blErr.message}`);
    } else {
      const existingBlocksByUid = new Map(
        (existingBlocks || [])
          .filter((b: { external_uid: string | null }) => b.external_uid)
          .map((b: { id: string; external_uid: string }) => [
            b.external_uid,
            b,
          ])
      );

      const feedBlockUids = new Set<string>();

      for (const event of blockedEvents) {
        feedBlockUids.add(event.uid);
        const existing = existingBlocksByUid.get(event.uid);

        if (!existing) {
          const { error: insertErr } = await supabase
            .from("property_blocked_dates")
            .insert({
              property_id: conn.property_id,
              user_id: conn.user_id,
              date_start: event.start,
              date_end: event.end,
              reason: event.summary,
              source,
              external_uid: event.uid,
            });

          if (insertErr) {
            errors.push(`Import block ${event.uid}: ${insertErr.message}`);
          } else {
            blocksImported++;
          }
        }
      }

      // Remove blocks no longer in the feed
      for (const [uid, block] of existingBlocksByUid) {
        if (!feedBlockUids.has(uid as string)) {
          const b = block as { id: string };
          await supabase
            .from("property_blocked_dates")
            .delete()
            .eq("id", b.id);
          blocksRemoved++;
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unknown error");
  }

  const syncResult = {
    bookings_imported: bookingsImported,
    bookings_skipped: bookingsSkipped,
    blocks_imported: blocksImported,
    blocks_removed: blocksRemoved,
    events_imported: bookingsImported + blocksImported,
    events_skipped: bookingsSkipped,
    errors: errors.length > 0 ? errors : null,
    synced_at: new Date().toISOString(),
  };

  await supabase
    .from("portal_connections")
    .update({
      last_sync: new Date().toISOString(),
      last_sync_result: syncResult,
      status:
        errors.length > 0 && bookingsImported === 0 && blocksImported === 0
          ? "error"
          : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  return {
    connection_id: conn.id,
    portal_name: conn.portal_name,
    property_name: String(propertyName),
    bookings_imported: bookingsImported,
    bookings_skipped: bookingsSkipped,
    blocks_imported: blocksImported,
    blocks_removed: blocksRemoved,
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
    if (!supabaseUrl || !supabaseKey)
      throw new Error("Missing Supabase config");

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
      const result = await syncConnection(
        supabase,
        conn as PortalConnection
      );
      results.push(result);
    }

    const totalBookingsImported = results.reduce(
      (s, r) => s + r.bookings_imported,
      0
    );
    const totalBlocksImported = results.reduce(
      (s, r) => s + r.blocks_imported,
      0
    );

    return new Response(
      JSON.stringify({
        success: true,
        connections_synced: results.length,
        total_events_imported:
          totalBookingsImported + totalBlocksImported,
        total_bookings_imported: totalBookingsImported,
        total_blocks_imported: totalBlocksImported,
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
