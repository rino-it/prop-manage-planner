import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConfirmPayload {
  staging_id: string;
  action: "confirm" | "reject";
  modifications?: {
    nome_ospite?: string;
    email_ospite?: string;
    telefono_ospite?: string;
    data_inizio?: string;
    data_fine?: string;
    tipo_affitto?: string;
    numero_ospiti?: number;
    codice_fiscale_ospite?: string;
    importo_totale?: number;
  };
}

interface BulkConfirmPayload {
  batch_id: string;
  action: "confirm_all" | "reject_all";
}

type RequestPayload = ConfirmPayload | BulkConfirmPayload;

function isBulk(payload: RequestPayload): payload is BulkConfirmPayload {
  return "batch_id" in payload;
}

async function confirmSingleItem(
  supabase: ReturnType<typeof createClient>,
  stagingId: string,
  action: "confirm" | "reject",
  modifications?: ConfirmPayload["modifications"]
): Promise<{ success: boolean; booking_id?: string; error?: string }> {
  const { data: item, error: fetchErr } = await supabase
    .from("sync_staging")
    .select("*")
    .eq("id", stagingId)
    .eq("status", "pending")
    .single();

  if (fetchErr || !item) {
    return {
      success: false,
      error: fetchErr?.message || "Item non trovato o gia processato",
    };
  }

  if (action === "reject") {
    await supabase
      .from("sync_staging")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", stagingId);

    return { success: true };
  }

  // action === 'confirm'
  const finalData = {
    nome_ospite: modifications?.nome_ospite || item.nome_ospite,
    email_ospite: modifications?.email_ospite || item.email_ospite,
    telefono_ospite: modifications?.telefono_ospite || item.telefono_ospite,
    data_inizio: modifications?.data_inizio || item.data_inizio,
    data_fine: modifications?.data_fine || item.data_fine,
    tipo_affitto: modifications?.tipo_affitto || item.tipo_affitto || "breve",
    numero_ospiti: modifications?.numero_ospiti || item.numero_ospiti || 1,
  };

  const hasModifications =
    modifications &&
    Object.keys(modifications).some(
      (key) =>
        modifications[key as keyof typeof modifications] !== undefined &&
        modifications[key as keyof typeof modifications] !==
          item[key as keyof typeof item]
    );

  let bookingId: string | undefined;

  if (item.change_type === "new") {
    const { data: newBooking, error: insertErr } = await supabase
      .from("bookings")
      .insert({
        property_id: item.property_id,
        user_id: item.user_id,
        nome_ospite: finalData.nome_ospite,
        email_ospite: finalData.email_ospite,
        telefono_ospite: finalData.telefono_ospite,
        data_inizio: finalData.data_inizio,
        data_fine: finalData.data_fine,
        tipo_affitto: finalData.tipo_affitto,
        numero_ospiti: finalData.numero_ospiti,
        external_uid: item.external_uid,
        source: item.source,
        checkin_status: "pending",
        codice_fiscale_ospite: modifications?.codice_fiscale_ospite || null,
        importo_totale: modifications?.importo_totale || null,
      })
      .select("id")
      .single();

    if (insertErr) {
      return { success: false, error: `Insert booking: ${insertErr.message}` };
    }
    bookingId = newBooking?.id;
  } else if (item.change_type === "updated") {
    if (!item.existing_booking_id) {
      return { success: false, error: "Booking ID mancante per aggiornamento" };
    }

    const { error: updateErr } = await supabase
      .from("bookings")
      .update({
        nome_ospite: finalData.nome_ospite,
        email_ospite: finalData.email_ospite,
        telefono_ospite: finalData.telefono_ospite,
        data_inizio: finalData.data_inizio,
        data_fine: finalData.data_fine,
        tipo_affitto: finalData.tipo_affitto,
        numero_ospiti: finalData.numero_ospiti,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.existing_booking_id);

    if (updateErr) {
      return {
        success: false,
        error: `Update booking: ${updateErr.message}`,
      };
    }
    bookingId = item.existing_booking_id;
  } else if (item.change_type === "cancelled") {
    if (!item.existing_booking_id) {
      return { success: false, error: "Booking ID mancante per cancellazione" };
    }

    const { error: deleteErr } = await supabase
      .from("bookings")
      .delete()
      .eq("id", item.existing_booking_id);

    if (deleteErr) {
      return {
        success: false,
        error: `Delete booking: ${deleteErr.message}`,
      };
    }
  }

  await supabase
    .from("sync_staging")
    .update({
      status: hasModifications ? "modified" : "confirmed",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", stagingId);

  return { success: true, booking_id: bookingId };
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

    const payload: RequestPayload = await req.json();

    if (isBulk(payload)) {
      const { data: items, error: fetchErr } = await supabase
        .from("sync_staging")
        .select("id")
        .eq("sync_batch_id", payload.batch_id)
        .eq("status", "pending");

      if (fetchErr) throw new Error(`Fetch batch: ${fetchErr.message}`);

      const action = payload.action === "confirm_all" ? "confirm" : "reject";
      const results = [];

      for (const item of items || []) {
        const result = await confirmSingleItem(supabase, item.id, action);
        results.push({ staging_id: item.id, ...result });
      }

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return new Response(
        JSON.stringify({
          success: true,
          processed: results.length,
          succeeded,
          failed,
          results,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await confirmSingleItem(
      supabase,
      payload.staging_id,
      payload.action,
      payload.modifications
    );

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
