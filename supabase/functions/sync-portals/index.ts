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
  /bloccato/i,
];

const BOOKING_PATTERNS = [
  /^reserved$/i,
  /^reservation$/i,
  /^prenotazione$/i,
  /^booked$/i,
  /HMAK\w/i,
];

function isBlockedEvent(summary: string): boolean {
  if (!summary || summary.trim().length === 0) return false;
  if (BOOKING_PATTERNS.some((p) => p.test(summary))) return false;
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
    const lines = block.split(/\r?\n/);
    const getField = (name: string): string | null => {
      const prefix = name.toUpperCase();
      for (const line of lines) {
        const upper = line.toUpperCase();
        if (upper.startsWith(prefix + ":") || upper.startsWith(prefix + ";")) {
          const colonIdx = line.indexOf(":");
          if (colonIdx >= 0) return line.substring(colonIdx + 1).trim();
        }
      }
      return null;
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
  conn: PortalConnection,
  batchId: string
): Promise<{
  connection_id: string;
  portal_name: string;
  property_name: string;
  staging_new: number;
  staging_updated: number;
  staging_cancelled: number;
  staging_skipped: number;
  blocks_imported: number;
  blocks_removed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let stagingNew = 0;
  let stagingUpdated = 0;
  let stagingCancelled = 0;
  let stagingSkipped = 0;
  let blocksImported = 0;
  let blocksRemoved = 0;
  const propertyName = conn.properties_real?.nome || conn.property_id;
  const source = `${conn.portal_name}_ical`;

  if (conn.connection_type !== "ical" || !conn.ical_url) {
    return {
      connection_id: conn.id,
      portal_name: conn.portal_name,
      property_name: String(propertyName),
      staging_new: 0,
      staging_updated: 0,
      staging_cancelled: 0,
      staging_skipped: 0,
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

    console.log(`[sync-portals] ${conn.portal_name} | ${propertyName} | fetch OK | ${icalText.length} bytes`);

    if (!icalText.includes("BEGIN:VCALENDAR")) {
      throw new Error(
        `Response is not valid iCal (${icalText.length} bytes, starts with: ${icalText.substring(0, 80)})`
      );
    }

    const events = parseIcal(icalText);
    const bookingEvents = events.filter((e) => !e.isBlocked);
    const blockedEvents = events.filter((e) => e.isBlocked);

    console.log(`[sync-portals] ${conn.portal_name} | ${propertyName} | events parsed: ${events.length} (bookings: ${bookingEvents.length}, blocked: ${blockedEvents.length})`);

    // --- BOOKINGS: scrivi su sync_staging invece di bookings ---
    const { data: existingBookings, error: bErr } = await supabase
      .from("bookings")
      .select("id, data_inizio, data_fine, external_uid, nome_ospite, email_ospite, telefono_ospite, tipo_affitto, numero_ospiti")
      .eq("property_id", conn.property_id)
      .eq("source", source);

    if (bErr) throw new Error(`Fetch bookings failed: ${bErr.message}`);

    const existingByUid = new Map(
      (existingBookings || [])
        .filter((b: { external_uid: string | null }) => b.external_uid)
        .map((b: {
          id: string;
          external_uid: string;
          data_inizio: string;
          data_fine: string;
          nome_ospite: string;
          email_ospite: string | null;
          telefono_ospite: string | null;
          tipo_affitto: string | null;
          numero_ospiti: number | null;
        }) => [b.external_uid, b])
    );

    // Controlla anche staging pending per evitare duplicati
    const { data: pendingStaging } = await supabase
      .from("sync_staging")
      .select("external_uid")
      .eq("connection_id", conn.id)
      .eq("status", "pending");

    const pendingUids = new Set(
      (pendingStaging || []).map((s: { external_uid: string }) => s.external_uid)
    );

    const feedBookingUids = new Set<string>();

    for (const event of bookingEvents) {
      feedBookingUids.add(event.uid);

      // Se gia in staging pending, skip
      if (pendingUids.has(event.uid)) {
        stagingSkipped++;
        continue;
      }

      const existing = existingByUid.get(event.uid) as
        | {
            id: string;
            data_inizio: string;
            data_fine: string;
            nome_ospite: string;
            email_ospite: string | null;
            telefono_ospite: string | null;
            tipo_affitto: string | null;
            numero_ospiti: number | null;
          }
        | undefined;

      if (existing) {
        const datesChanged =
          existing.data_inizio !== event.start ||
          existing.data_fine !== event.end;
        const nameChanged = existing.nome_ospite !== event.summary;

        if (datesChanged || nameChanged) {
          const { error: insertErr } = await supabase
            .from("sync_staging")
            .insert({
              sync_batch_id: batchId,
              connection_id: conn.id,
              property_id: conn.property_id,
              user_id: conn.user_id,
              external_uid: event.uid,
              portal_name: conn.portal_name,
              source,
              event_type: "booking",
              change_type: "updated",
              nome_ospite: event.summary,
              email_ospite: existing.email_ospite,
              telefono_ospite: existing.telefono_ospite,
              data_inizio: event.start,
              data_fine: event.end,
              raw_summary: event.summary,
              numero_ospiti: existing.numero_ospiti || 1,
              tipo_affitto: existing.tipo_affitto || "breve",
              existing_booking_id: existing.id,
              previous_data: {
                nome_ospite: existing.nome_ospite,
                data_inizio: existing.data_inizio,
                data_fine: existing.data_fine,
              },
            });

          if (insertErr) {
            errors.push(`Stage update ${event.uid}: ${insertErr.message}`);
          } else {
            stagingUpdated++;
          }
        } else {
          stagingSkipped++;
        }
      } else {
        const { error: insertErr } = await supabase
          .from("sync_staging")
          .insert({
            sync_batch_id: batchId,
            connection_id: conn.id,
            property_id: conn.property_id,
            user_id: conn.user_id,
            external_uid: event.uid,
            portal_name: conn.portal_name,
            source,
            event_type: "booking",
            change_type: "new",
            nome_ospite: event.summary,
            data_inizio: event.start,
            data_fine: event.end,
            raw_summary: event.summary,
            tipo_affitto: "breve",
          });

        if (insertErr) {
          errors.push(`Stage new ${event.uid}: ${insertErr.message}`);
          stagingSkipped++;
        } else {
          stagingNew++;
        }
      }
    }

    // Cancellazioni: booking esistente non piu nel feed
    for (const [uid, booking] of existingByUid) {
      if (!feedBookingUids.has(uid as string) && !pendingUids.has(uid as string)) {
        const b = booking as {
          id: string;
          data_inizio: string;
          data_fine: string;
          nome_ospite: string;
        };
        const { error: insertErr } = await supabase
          .from("sync_staging")
          .insert({
            sync_batch_id: batchId,
            connection_id: conn.id,
            property_id: conn.property_id,
            user_id: conn.user_id,
            external_uid: uid as string,
            portal_name: conn.portal_name,
            source,
            event_type: "booking",
            change_type: "cancelled",
            nome_ospite: b.nome_ospite,
            data_inizio: b.data_inizio,
            data_fine: b.data_fine,
            raw_summary: b.nome_ospite,
            existing_booking_id: b.id,
            previous_data: {
              nome_ospite: b.nome_ospite,
              data_inizio: b.data_inizio,
              data_fine: b.data_fine,
            },
          });

        if (insertErr) {
          errors.push(`Stage cancel ${uid}: ${insertErr.message}`);
        } else {
          stagingCancelled++;
        }
      }
    }

    // --- BLOCKED DATES: gestione diretta (no review necessario) ---
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

  const totalStaged = stagingNew + stagingUpdated + stagingCancelled;

  const syncResult = {
    staging_new: stagingNew,
    staging_updated: stagingUpdated,
    staging_cancelled: stagingCancelled,
    staging_skipped: stagingSkipped,
    blocks_imported: blocksImported,
    blocks_removed: blocksRemoved,
    events_imported: totalStaged + blocksImported,
    events_skipped: stagingSkipped,
    errors: errors.length > 0 ? errors : null,
    synced_at: new Date().toISOString(),
  };

  await supabase
    .from("portal_connections")
    .update({
      last_sync: new Date().toISOString(),
      last_sync_result: syncResult,
      status:
        errors.length > 0 && totalStaged === 0 && blocksImported === 0
          ? "error"
          : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  return {
    connection_id: conn.id,
    portal_name: conn.portal_name,
    property_name: String(propertyName),
    staging_new: stagingNew,
    staging_updated: stagingUpdated,
    staging_cancelled: stagingCancelled,
    staging_skipped: stagingSkipped,
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

    // Un batch ID unico per questo sync
    const batchId = crypto.randomUUID();

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
        conn as PortalConnection,
        batchId
      );
      results.push(result);
    }

    const totalStaged = results.reduce(
      (s, r) => s + r.staging_new + r.staging_updated + r.staging_cancelled,
      0
    );
    const totalBlocksImported = results.reduce(
      (s, r) => s + r.blocks_imported,
      0
    );

    return new Response(
      JSON.stringify({
        success: true,
        sync_batch_id: batchId,
        connections_synced: results.length,
        total_staged: totalStaged,
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
