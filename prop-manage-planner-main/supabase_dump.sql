


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."activity_type" AS ENUM (
    'manutenzione',
    'pulizia',
    'ispezione',
    'generale'
);


ALTER TYPE "public"."activity_type" OWNER TO "postgres";


CREATE TYPE "public"."document_type" AS ENUM (
    'contratto',
    'assicurazione',
    'certificato',
    'fattura',
    'libretto',
    'altro'
);


ALTER TYPE "public"."document_type" OWNER TO "postgres";


CREATE TYPE "public"."fuel_type" AS ENUM (
    'benzina',
    'diesel',
    'gpl',
    'metano',
    'elettrico'
);


ALTER TYPE "public"."fuel_type" OWNER TO "postgres";


CREATE TYPE "public"."maintenance_type" AS ENUM (
    'tagliando',
    'revisione',
    'riparazione',
    'sostituzione_parti'
);


ALTER TYPE "public"."maintenance_type" OWNER TO "postgres";


CREATE TYPE "public"."mobile_category" AS ENUM (
    'veicolo',
    'imbarcazione',
    'attrezzatura'
);


ALTER TYPE "public"."mobile_category" OWNER TO "postgres";


CREATE TYPE "public"."payment_category" AS ENUM (
    'condominio',
    'tasse',
    'assicurazione',
    'bollo',
    'manutenzione',
    'altro'
);


ALTER TYPE "public"."payment_category" OWNER TO "postgres";


CREATE TYPE "public"."payment_recurrence" AS ENUM (
    'mensile',
    'trimestrale',
    'semestrale',
    'annuale'
);


ALTER TYPE "public"."payment_recurrence" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'in_attesa',
    'pagato',
    'scaduto',
    'parzialmente_pagato'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."priority_level" AS ENUM (
    'alta',
    'media',
    'bassa'
);


ALTER TYPE "public"."priority_level" OWNER TO "postgres";


CREATE TYPE "public"."property_status" AS ENUM (
    'ottimo',
    'buono',
    'discreto',
    'da_ristrutturare'
);


ALTER TYPE "public"."property_status" OWNER TO "postgres";


CREATE TYPE "public"."property_type" AS ENUM (
    'appartamento',
    'casa',
    'ufficio',
    'magazzino'
);


ALTER TYPE "public"."property_type" OWNER TO "postgres";


CREATE TYPE "public"."recurrence_type" AS ENUM (
    'giornaliera',
    'settimanale',
    'mensile',
    'trimestrale',
    'semestrale',
    'annuale',
    'personalizzata'
);


ALTER TYPE "public"."recurrence_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_property_code"("property_type" "text", "user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  prefix TEXT;
  counter INTEGER;
  new_code TEXT;
BEGIN
  -- Set prefix based on property type
  prefix := CASE 
    WHEN property_type = 'real' THEN 'PV'
    WHEN property_type = 'mobile' THEN 'PM'
    ELSE 'PR'
  END;
  
  -- Get next counter for this user and type
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(codice_identificativo FROM '^' || prefix || '(\d+)$') AS INTEGER)
  ), 0) + 1 INTO counter
  FROM (
    SELECT codice_identificativo FROM public.properties_real WHERE properties_real.user_id = generate_property_code.user_id
    UNION ALL
    SELECT codice_identificativo FROM public.properties_mobile WHERE properties_mobile.user_id = generate_property_code.user_id
  ) combined_properties
  WHERE codice_identificativo ~ ('^' || prefix || '\d+$');
  
  -- Format with leading zeros
  new_code := prefix || LPAD(counter::TEXT, 3, '0');
  
  RETURN new_code;
END;
$_$;


ALTER FUNCTION "public"."generate_property_code"("property_type" "text", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.email
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "property_real_id" "uuid",
    "property_mobile_id" "uuid",
    "nome" "text" NOT NULL,
    "descrizione" "text",
    "tipo" "public"."activity_type" DEFAULT 'generale'::"public"."activity_type" NOT NULL,
    "ricorrenza_tipo" "public"."recurrence_type" DEFAULT 'mensile'::"public"."recurrence_type" NOT NULL,
    "ricorrenza_intervallo" integer DEFAULT 1,
    "giorno_specifico" integer,
    "mese_specifico" integer,
    "prossima_scadenza" timestamp with time zone NOT NULL,
    "ultima_esecuzione" timestamp with time zone,
    "costo" numeric(10,2) DEFAULT 0,
    "fornitore" "text",
    "priorita" "public"."priority_level" DEFAULT 'media'::"public"."priority_level",
    "completata" boolean DEFAULT false,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activities_property_check" CHECK (((("property_real_id" IS NOT NULL) AND ("property_mobile_id" IS NULL)) OR (("property_real_id" IS NULL) AND ("property_mobile_id" IS NOT NULL))))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid",
    "user_id" "uuid",
    "tipo_affitto" "text",
    "nome_ospite" "text" NOT NULL,
    "email_ospite" "text",
    "telefono_ospite" "text",
    "data_inizio" "date" NOT NULL,
    "data_fine" "date" NOT NULL,
    "checkin_status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "documenti_url" "text",
    "documenti_caricati" boolean DEFAULT false,
    "stato_documenti" "text" DEFAULT 'mancante'::"text",
    CONSTRAINT "bookings_checkin_status_check" CHECK (("checkin_status" = ANY (ARRAY['pending'::"text", 'effettuato'::"text", 'checkout_fatto'::"text"]))),
    CONSTRAINT "bookings_stato_documenti_check" CHECK (("stato_documenti" = ANY (ARRAY['mancante'::"text", 'in_revisione'::"text", 'approvato'::"text", 'rifiutato'::"text"]))),
    CONSTRAINT "bookings_tipo_affitto_check" CHECK (("tipo_affitto" = ANY (ARRAY['breve'::"text", 'lungo'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "property_real_id" "uuid",
    "property_mobile_id" "uuid",
    "nome" "text" NOT NULL,
    "tipo" "public"."document_type" DEFAULT 'altro'::"public"."document_type" NOT NULL,
    "url" "text",
    "dimensione" bigint,
    "formato" "text",
    "data_caricamento" timestamp with time zone DEFAULT "now"() NOT NULL,
    "data_scadenza" timestamp with time zone,
    "alert_scadenza_attivo" boolean DEFAULT false,
    "alert_giorni_prima" integer DEFAULT 30,
    "ultimo_alert" timestamp with time zone,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "documents_property_check" CHECK (((("property_real_id" IS NOT NULL) AND ("property_mobile_id" IS NULL)) OR (("property_real_id" IS NULL) AND ("property_mobile_id" IS NOT NULL)) OR (("property_real_id" IS NULL) AND ("property_mobile_id" IS NULL))))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."income" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "property_real_id" "uuid",
    "property_mobile_id" "uuid",
    "tipo_entrata" "text" DEFAULT 'affitto'::"text" NOT NULL,
    "importo" numeric NOT NULL,
    "data_incasso" "date" DEFAULT CURRENT_DATE NOT NULL,
    "periodo_riferimento" "date",
    "descrizione" "text" NOT NULL,
    "inquilino" "text",
    "stato" "text" DEFAULT 'incassato'::"text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "income_property_check" CHECK (((("property_real_id" IS NOT NULL) AND ("property_mobile_id" IS NULL)) OR (("property_real_id" IS NULL) AND ("property_mobile_id" IS NOT NULL)))),
    CONSTRAINT "income_stato_check" CHECK (("stato" = ANY (ARRAY['incassato'::"text", 'in_attesa'::"text", 'parziale'::"text"]))),
    CONSTRAINT "income_tipo_entrata_check" CHECK (("tipo_entrata" = ANY (ARRAY['affitto'::"text", 'rimborso_spese'::"text", 'plusvalenza'::"text", 'altro'::"text"])))
);


ALTER TABLE "public"."income" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maintenance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_mobile_id" "uuid" NOT NULL,
    "data_manutenzione" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo" "public"."maintenance_type" NOT NULL,
    "costo" numeric(10,2) NOT NULL,
    "chilometraggio" integer,
    "descrizione" "text" NOT NULL,
    "officina" "text",
    "prossima_manutenzione" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."maintenance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "titolo" "text" NOT NULL,
    "messaggio" "text" NOT NULL,
    "data_scadenza" "date" NOT NULL,
    "giorni_preavviso" integer DEFAULT 15,
    "inviata" boolean DEFAULT false,
    "data_invio" timestamp with time zone,
    "priorita" "text" DEFAULT 'media'::"text",
    "property_real_id" "uuid",
    "property_mobile_id" "uuid",
    "payment_id" "uuid",
    "activity_id" "uuid",
    "document_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_priorita_check" CHECK (("priorita" = ANY (ARRAY['bassa'::"text", 'media'::"text", 'alta'::"text", 'critica'::"text"]))),
    CONSTRAINT "notifications_tipo_check" CHECK (("tipo" = ANY (ARRAY['scadenza_pagamento'::"text", 'scadenza_contratto'::"text", 'manutenzione_programmata'::"text", 'rinnovo_documento'::"text", 'promemoria_generale'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "importo_pagato" numeric(10,2) NOT NULL,
    "data_pagamento" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metodo_pagamento" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "property_real_id" "uuid",
    "property_mobile_id" "uuid",
    "descrizione" "text" NOT NULL,
    "importo" numeric(10,2) NOT NULL,
    "importo_originale" numeric(10,2) NOT NULL,
    "scadenza" timestamp with time zone NOT NULL,
    "ricorrenza_tipo" "public"."payment_recurrence" DEFAULT 'mensile'::"public"."payment_recurrence" NOT NULL,
    "escalation_attiva" boolean DEFAULT false,
    "escalation_percentuale" numeric(5,2) DEFAULT 0,
    "escalation_applica_ogni_anno" boolean DEFAULT true,
    "stato" "public"."payment_status" DEFAULT 'in_attesa'::"public"."payment_status",
    "fornitore" "text",
    "categoria" "public"."payment_category" DEFAULT 'altro'::"public"."payment_category",
    "metodo_pagamento" "text",
    "data_pagamento" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_property_check" CHECK (((("property_real_id" IS NOT NULL) AND ("property_mobile_id" IS NULL)) OR (("property_real_id" IS NULL) AND ("property_mobile_id" IS NOT NULL))))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "phone" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties_mobile" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "categoria" "public"."mobile_category" NOT NULL,
    "marca" "text",
    "modello" "text",
    "anno" integer,
    "targa" "text",
    "numero_telaio" "text",
    "chilometraggio" integer,
    "numero_immatricolazione" "text",
    "numero_serie" "text",
    "porto_stazionamento" "text",
    "valore_acquisto" numeric(12,2),
    "valore_attuale" numeric(12,2),
    "costi_manutenzione_annuali" numeric(12,2),
    "consumo_medio" numeric(8,2),
    "costo_per_km" numeric(8,4),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "codice_identificativo" "text",
    "stato" "text" DEFAULT 'uso_personale'::"text",
    "proprietario_legale" "text",
    "quota_possesso" numeric DEFAULT 100,
    CONSTRAINT "properties_mobile_quota_possesso_check" CHECK ((("quota_possesso" > (0)::numeric) AND ("quota_possesso" <= (100)::numeric))),
    CONSTRAINT "properties_mobile_stato_check" CHECK (("stato" = ANY (ARRAY['uso_personale'::"text", 'affitto'::"text", 'vendita'::"text", 'manutenzione'::"text"])))
);


ALTER TABLE "public"."properties_mobile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties_real" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "via" "text" NOT NULL,
    "citta" "text" NOT NULL,
    "cap" "text" NOT NULL,
    "provincia" "text" NOT NULL,
    "tipo" "public"."property_type" NOT NULL,
    "metri_quadrati" integer,
    "numero_vani" integer,
    "anno_costruzione" integer,
    "stato_conservazione" "public"."property_status" DEFAULT 'buono'::"public"."property_status",
    "valore_acquisto" numeric(12,2),
    "valore_catastale" numeric(12,2),
    "rendita" numeric(12,2),
    "costi_gestione_annuali" numeric(12,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "codice_identificativo" "text",
    "stato" "text" DEFAULT 'uso_personale'::"text",
    "proprietario_legale" "text",
    "quota_possesso" numeric DEFAULT 100,
    "canone_mensile" numeric DEFAULT 0,
    "data_inizio_contratto" "date",
    "data_fine_contratto" "date",
    "inquilino" "text",
    "contatto_inquilino" "text",
    "ical_url" "text",
    "wifi_ssid" "text",
    "wifi_password" "text",
    "istruzioni_checkin" "text",
    "codice_keybox" "text",
    "staff_token" "uuid" DEFAULT "gen_random_uuid"(),
    CONSTRAINT "properties_real_quota_possesso_check" CHECK ((("quota_possesso" > (0)::numeric) AND ("quota_possesso" <= (100)::numeric))),
    CONSTRAINT "properties_real_stato_check" CHECK (("stato" = ANY (ARRAY['uso_personale'::"text", 'affitto'::"text", 'ristrutturazione'::"text", 'vendita'::"text"])))
);


ALTER TABLE "public"."properties_real" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."property_performance" AS
 SELECT "pr"."id",
    "pr"."codice_identificativo",
    "pr"."nome",
    "pr"."stato",
    "pr"."valore_acquisto",
    "pr"."canone_mensile",
    COALESCE("yearly_income"."total_income", (0)::numeric) AS "reddito_annuale",
    COALESCE("yearly_expenses"."total_expenses", (0)::numeric) AS "spese_annuali",
    (COALESCE("yearly_income"."total_income", (0)::numeric) - COALESCE("yearly_expenses"."total_expenses", (0)::numeric)) AS "reddito_netto_annuale",
        CASE
            WHEN (("pr"."valore_acquisto" > (0)::numeric) AND ("pr"."valore_acquisto" IS NOT NULL)) THEN (((COALESCE("yearly_income"."total_income", (0)::numeric) - COALESCE("yearly_expenses"."total_expenses", (0)::numeric)) / "pr"."valore_acquisto") * (100)::numeric)
            ELSE (0)::numeric
        END AS "roi_percentuale",
        CASE
            WHEN ("pr"."canone_mensile" > (0)::numeric) THEN ("pr"."canone_mensile" * (12)::numeric)
            ELSE (0)::numeric
        END AS "reddito_teorico_annuale"
   FROM (("public"."properties_real" "pr"
     LEFT JOIN ( SELECT "income"."property_real_id",
            "sum"("income"."importo") AS "total_income"
           FROM "public"."income"
          WHERE (("income"."data_incasso" >= (CURRENT_DATE - '1 year'::interval)) AND ("income"."user_id" = "auth"."uid"()))
          GROUP BY "income"."property_real_id") "yearly_income" ON (("pr"."id" = "yearly_income"."property_real_id")))
     LEFT JOIN ( SELECT "payments"."property_real_id",
            "sum"("payments"."importo") AS "total_expenses"
           FROM "public"."payments"
          WHERE (("payments"."scadenza" >= (CURRENT_DATE - '1 year'::interval)) AND ("payments"."stato" = 'pagato'::"public"."payment_status") AND ("payments"."user_id" = "auth"."uid"()))
          GROUP BY "payments"."property_real_id") "yearly_expenses" ON (("pr"."id" = "yearly_expenses"."property_real_id")))
  WHERE ("pr"."user_id" = "auth"."uid"());


ALTER VIEW "public"."property_performance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refueling" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_mobile_id" "uuid" NOT NULL,
    "data_rifornimento" timestamp with time zone DEFAULT "now"() NOT NULL,
    "litri" numeric(8,3) NOT NULL,
    "costo_totale" numeric(8,2) NOT NULL,
    "costo_per_litro" numeric(6,3) NOT NULL,
    "chilometraggio" integer,
    "tipo_carburante" "public"."fuel_type" DEFAULT 'benzina'::"public"."fuel_type" NOT NULL,
    "stazione_servizio" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."refueling" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "service_id" "uuid",
    "stato" "text" DEFAULT 'richiesto'::"text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "service_requests_stato_check" CHECK (("stato" = ANY (ARRAY['richiesto'::"text", 'confermato'::"text", 'rifiutato'::"text"])))
);


ALTER TABLE "public"."service_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titolo" "text" NOT NULL,
    "descrizione" "text",
    "prezzo" numeric(10,2),
    "link_prenotazione" "text",
    "immagine_url" "text",
    "attivo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "payment_link" "text"
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "tipo" "text",
    "importo" numeric(10,2) NOT NULL,
    "data_scadenza" "date" NOT NULL,
    "stato" "text" DEFAULT 'da_pagare'::"text",
    "consumo_kw_mc" numeric(10,2),
    "periodo_riferimento" "text",
    "documento_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tenant_payments_stato_check" CHECK (("stato" = ANY (ARRAY['da_pagare'::"text", 'pagato'::"text", 'scaduto'::"text"]))),
    CONSTRAINT "tenant_payments_tipo_check" CHECK (("tipo" = ANY (ARRAY['affitto'::"text", 'bolletta_luce'::"text", 'bolletta_gas'::"text", 'internet'::"text", 'condominio'::"text", 'altro'::"text"])))
);


ALTER TABLE "public"."tenant_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "titolo" "text" NOT NULL,
    "descrizione" "text",
    "stato" "text" DEFAULT 'aperto'::"text",
    "priorita" "text" DEFAULT 'media'::"text",
    "foto_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tickets_stato_check" CHECK (("stato" = ANY (ARRAY['aperto'::"text", 'in_lavorazione'::"text", 'risolto'::"text"])))
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vouchers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "codice" "text" NOT NULL,
    "valore" numeric(10,2),
    "descrizione" "text",
    "usato" boolean DEFAULT false
);


ALTER TABLE "public"."vouchers" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."income"
    ADD CONSTRAINT "income_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance"
    ADD CONSTRAINT "maintenance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_history"
    ADD CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."properties_mobile"
    ADD CONSTRAINT "properties_mobile_codice_identificativo_key" UNIQUE ("codice_identificativo");



ALTER TABLE ONLY "public"."properties_mobile"
    ADD CONSTRAINT "properties_mobile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties_real"
    ADD CONSTRAINT "properties_real_codice_identificativo_key" UNIQUE ("codice_identificativo");



ALTER TABLE ONLY "public"."properties_real"
    ADD CONSTRAINT "properties_real_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refueling"
    ADD CONSTRAINT "refueling_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_payments"
    ADD CONSTRAINT "tenant_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activities_prossima_scadenza" ON "public"."activities" USING "btree" ("prossima_scadenza");



CREATE INDEX "idx_activities_user_id" ON "public"."activities" USING "btree" ("user_id");



CREATE INDEX "idx_documents_data_scadenza" ON "public"."documents" USING "btree" ("data_scadenza");



CREATE INDEX "idx_documents_user_id" ON "public"."documents" USING "btree" ("user_id");



CREATE INDEX "idx_maintenance_property_mobile_id" ON "public"."maintenance" USING "btree" ("property_mobile_id");



CREATE INDEX "idx_payments_scadenza" ON "public"."payments" USING "btree" ("scadenza");



CREATE INDEX "idx_payments_stato" ON "public"."payments" USING "btree" ("stato");



CREATE INDEX "idx_payments_user_id" ON "public"."payments" USING "btree" ("user_id");



CREATE INDEX "idx_properties_mobile_user_id" ON "public"."properties_mobile" USING "btree" ("user_id");



CREATE INDEX "idx_properties_real_user_id" ON "public"."properties_real" USING "btree" ("user_id");



CREATE INDEX "idx_refueling_property_mobile_id" ON "public"."refueling" USING "btree" ("property_mobile_id");



CREATE OR REPLACE TRIGGER "update_activities_updated_at" BEFORE UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_documents_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_income_updated_at" BEFORE UPDATE ON "public"."income" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_properties_mobile_updated_at" BEFORE UPDATE ON "public"."properties_mobile" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_properties_real_updated_at" BEFORE UPDATE ON "public"."properties_real" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tickets_updated_at" BEFORE UPDATE ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_property_mobile_id_fkey" FOREIGN KEY ("property_mobile_id") REFERENCES "public"."properties_mobile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_property_real_id_fkey" FOREIGN KEY ("property_real_id") REFERENCES "public"."properties_real"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties_real"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_property_mobile_id_fkey" FOREIGN KEY ("property_mobile_id") REFERENCES "public"."properties_mobile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_property_real_id_fkey" FOREIGN KEY ("property_real_id") REFERENCES "public"."properties_real"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."income"
    ADD CONSTRAINT "income_property_mobile_id_fkey" FOREIGN KEY ("property_mobile_id") REFERENCES "public"."properties_mobile"("id");



ALTER TABLE ONLY "public"."income"
    ADD CONSTRAINT "income_property_real_id_fkey" FOREIGN KEY ("property_real_id") REFERENCES "public"."properties_real"("id");



ALTER TABLE ONLY "public"."maintenance"
    ADD CONSTRAINT "maintenance_property_mobile_id_fkey" FOREIGN KEY ("property_mobile_id") REFERENCES "public"."properties_mobile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_property_mobile_id_fkey" FOREIGN KEY ("property_mobile_id") REFERENCES "public"."properties_mobile"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_property_real_id_fkey" FOREIGN KEY ("property_real_id") REFERENCES "public"."properties_real"("id");



ALTER TABLE ONLY "public"."payment_history"
    ADD CONSTRAINT "payment_history_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_property_mobile_id_fkey" FOREIGN KEY ("property_mobile_id") REFERENCES "public"."properties_mobile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_property_real_id_fkey" FOREIGN KEY ("property_real_id") REFERENCES "public"."properties_real"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties_mobile"
    ADD CONSTRAINT "properties_mobile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties_real"
    ADD CONSTRAINT "properties_real_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refueling"
    ADD CONSTRAINT "refueling_property_mobile_id_fkey" FOREIGN KEY ("property_mobile_id") REFERENCES "public"."properties_mobile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."tenant_payments"
    ADD CONSTRAINT "tenant_payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



CREATE POLICY "Guest Update Booking" ON "public"."bookings" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Manager access bookings" ON "public"."bookings" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Manager access payments" ON "public"."tenant_payments" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Manager access requests" ON "public"."service_requests" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Manager access services" ON "public"."services" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Manager access tickets" ON "public"."tickets" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Manager access vouchers" ON "public"."vouchers" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Public create service requests" ON "public"."service_requests" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Public create tickets" ON "public"."tickets" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Public read bookings" ON "public"."bookings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public read services" ON "public"."services" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public read vouchers" ON "public"."vouchers" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Users can create their own activities" ON "public"."activities" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own documents" ON "public"."documents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own income" ON "public"."income" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own maintenance data" ON "public"."maintenance" FOR INSERT WITH CHECK (("property_mobile_id" IN ( SELECT "properties_mobile"."id"
   FROM "public"."properties_mobile"
  WHERE ("properties_mobile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create their own mobile properties" ON "public"."properties_mobile" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own payment history" ON "public"."payment_history" FOR INSERT WITH CHECK (("payment_id" IN ( SELECT "payments"."id"
   FROM "public"."payments"
  WHERE ("payments"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create their own payments" ON "public"."payments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own real properties" ON "public"."properties_real" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own refueling data" ON "public"."refueling" FOR INSERT WITH CHECK (("property_mobile_id" IN ( SELECT "properties_mobile"."id"
   FROM "public"."properties_mobile"
  WHERE ("properties_mobile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own activities" ON "public"."activities" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own documents" ON "public"."documents" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own income" ON "public"."income" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own maintenance data" ON "public"."maintenance" FOR DELETE USING (("property_mobile_id" IN ( SELECT "properties_mobile"."id"
   FROM "public"."properties_mobile"
  WHERE ("properties_mobile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own mobile properties" ON "public"."properties_mobile" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own payments" ON "public"."payments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own real properties" ON "public"."properties_real" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own refueling data" ON "public"."refueling" FOR DELETE USING (("property_mobile_id" IN ( SELECT "properties_mobile"."id"
   FROM "public"."properties_mobile"
  WHERE ("properties_mobile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own activities" ON "public"."activities" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own documents" ON "public"."documents" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own income" ON "public"."income" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own maintenance data" ON "public"."maintenance" FOR UPDATE USING (("property_mobile_id" IN ( SELECT "properties_mobile"."id"
   FROM "public"."properties_mobile"
  WHERE ("properties_mobile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own mobile properties" ON "public"."properties_mobile" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own payments" ON "public"."payments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own real properties" ON "public"."properties_real" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own refueling data" ON "public"."refueling" FOR UPDATE USING (("property_mobile_id" IN ( SELECT "properties_mobile"."id"
   FROM "public"."properties_mobile"
  WHERE ("properties_mobile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own activities" ON "public"."activities" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own documents" ON "public"."documents" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own income" ON "public"."income" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own maintenance data" ON "public"."maintenance" FOR SELECT USING (("property_mobile_id" IN ( SELECT "properties_mobile"."id"
   FROM "public"."properties_mobile"
  WHERE ("properties_mobile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own mobile properties" ON "public"."properties_mobile" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own payment history" ON "public"."payment_history" FOR SELECT USING (("payment_id" IN ( SELECT "payments"."id"
   FROM "public"."payments"
  WHERE ("payments"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own payments" ON "public"."payments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own real properties" ON "public"."properties_real" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own refueling data" ON "public"."refueling" FOR SELECT USING (("property_mobile_id" IN ( SELECT "properties_mobile"."id"
   FROM "public"."properties_mobile"
  WHERE ("properties_mobile"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."income" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maintenance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."properties_mobile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."properties_real" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."refueling" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vouchers" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."generate_property_code"("property_type" "text", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_property_code"("property_type" "text", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_property_code"("property_type" "text", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."income" TO "anon";
GRANT ALL ON TABLE "public"."income" TO "authenticated";
GRANT ALL ON TABLE "public"."income" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance" TO "anon";
GRANT ALL ON TABLE "public"."maintenance" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."payment_history" TO "anon";
GRANT ALL ON TABLE "public"."payment_history" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_history" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."properties_mobile" TO "anon";
GRANT ALL ON TABLE "public"."properties_mobile" TO "authenticated";
GRANT ALL ON TABLE "public"."properties_mobile" TO "service_role";



GRANT ALL ON TABLE "public"."properties_real" TO "anon";
GRANT ALL ON TABLE "public"."properties_real" TO "authenticated";
GRANT ALL ON TABLE "public"."properties_real" TO "service_role";



GRANT ALL ON TABLE "public"."property_performance" TO "anon";
GRANT ALL ON TABLE "public"."property_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."property_performance" TO "service_role";



GRANT ALL ON TABLE "public"."refueling" TO "anon";
GRANT ALL ON TABLE "public"."refueling" TO "authenticated";
GRANT ALL ON TABLE "public"."refueling" TO "service_role";



GRANT ALL ON TABLE "public"."service_requests" TO "anon";
GRANT ALL ON TABLE "public"."service_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."service_requests" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_payments" TO "anon";
GRANT ALL ON TABLE "public"."tenant_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_payments" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON TABLE "public"."vouchers" TO "anon";
GRANT ALL ON TABLE "public"."vouchers" TO "authenticated";
GRANT ALL ON TABLE "public"."vouchers" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































