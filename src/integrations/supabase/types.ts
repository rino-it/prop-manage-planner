export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          completata: boolean | null
          costo: number | null
          created_at: string
          descrizione: string | null
          fornitore: string | null
          giorno_specifico: number | null
          id: string
          mese_specifico: number | null
          nome: string
          note: string | null
          priorita: Database["public"]["Enums"]["priority_level"] | null
          property_mobile_id: string | null
          property_real_id: string | null
          prossima_scadenza: string
          ricorrenza_intervallo: number | null
          ricorrenza_tipo: Database["public"]["Enums"]["recurrence_type"]
          tipo: Database["public"]["Enums"]["activity_type"]
          ultima_esecuzione: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completata?: boolean | null
          costo?: number | null
          created_at?: string
          descrizione?: string | null
          fornitore?: string | null
          giorno_specifico?: number | null
          id?: string
          mese_specifico?: number | null
          nome: string
          note?: string | null
          priorita?: Database["public"]["Enums"]["priority_level"] | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          prossima_scadenza: string
          ricorrenza_intervallo?: number | null
          ricorrenza_tipo?: Database["public"]["Enums"]["recurrence_type"]
          tipo?: Database["public"]["Enums"]["activity_type"]
          ultima_esecuzione?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completata?: boolean | null
          costo?: number | null
          created_at?: string
          descrizione?: string | null
          fornitore?: string | null
          giorno_specifico?: number | null
          id?: string
          mese_specifico?: number | null
          nome?: string
          note?: string | null
          priorita?: Database["public"]["Enums"]["priority_level"] | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          prossima_scadenza?: string
          ricorrenza_intervallo?: number | null
          ricorrenza_tipo?: Database["public"]["Enums"]["recurrence_type"]
          tipo?: Database["public"]["Enums"]["activity_type"]
          ultima_esecuzione?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_property_mobile_id_fkey"
            columns: ["property_mobile_id"]
            isOneToOne: false
            referencedRelation: "properties_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_property_real_id_fkey"
            columns: ["property_real_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_property_real_id_fkey"
            columns: ["property_real_id"]
            isOneToOne: false
            referencedRelation: "property_performance"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          alert_giorni_prima: number | null
          alert_scadenza_attivo: boolean | null
          created_at: string
          data_caricamento: string
          data_scadenza: string | null
          dimensione: number | null
          formato: string | null
          id: string
          nome: string
          property_mobile_id: string | null
          property_real_id: string | null
          tags: string[] | null
          tipo: Database["public"]["Enums"]["document_type"]
          ultimo_alert: string | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          alert_giorni_prima?: number | null
          alert_scadenza_attivo?: boolean | null
          created_at?: string
          data_caricamento?: string
          data_scadenza?: string | null
          dimensione?: number | null
          formato?: string | null
          id?: string
          nome: string
          property_mobile_id?: string | null
          property_real_id?: string | null
          tags?: string[] | null
          tipo?: Database["public"]["Enums"]["document_type"]
          ultimo_alert?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          alert_giorni_prima?: number | null
          alert_scadenza_attivo?: boolean | null
          created_at?: string
          data_caricamento?: string
          data_scadenza?: string | null
          dimensione?: number | null
          formato?: string | null
          id?: string
          nome?: string
          property_mobile_id?: string | null
          property_real_id?: string | null
          tags?: string[] | null
          tipo?: Database["public"]["Enums"]["document_type"]
          ultimo_alert?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_property_mobile_id_fkey"
            columns: ["property_mobile_id"]
            isOneToOne: false
            referencedRelation: "properties_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_real_id_fkey"
            columns: ["property_real_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_real_id_fkey"
            columns: ["property_real_id"]
            isOneToOne: false
            referencedRelation: "property_performance"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          created_at: string
          data_incasso: string
          descrizione: string
          id: string
          importo: number
          inquilino: string | null
          note: string | null
          periodo_riferimento: string | null
          property_mobile_id: string | null
          property_real_id: string | null
          stato: string | null
          tipo_entrata: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_incasso?: string
          descrizione: string
          id?: string
          importo: number
          inquilino?: string | null
          note?: string | null
          periodo_riferimento?: string | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          stato?: string | null
          tipo_entrata?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_incasso?: string
          descrizione?: string
          id?: string
          importo?: number
          inquilino?: string | null
          note?: string | null
          periodo_riferimento?: string | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          stato?: string | null
          tipo_entrata?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_property_mobile_id_fkey"
            columns: ["property_mobile_id"]
            isOneToOne: false
            referencedRelation: "properties_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_property_real_id_fkey"
            columns: ["property_real_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_property_real_id_fkey"
            columns: ["property_real_id"]
            isOneToOne: false
            referencedRelation: "property_performance"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance: {
        Row: {
          chilometraggio: number | null
          costo: number
          created_at: string
          data_manutenzione: string
          descrizione: string
          id: string
          note: string | null
          officina: string | null
          property_mobile_id: string
          prossima_manutenzione: string | null
          tipo: Database["public"]["Enums"]["maintenance_type"]
        }
        Insert: {
          chilometraggio?: number | null
          costo: number
          created_at?: string
          data_manutenzione?: string
          descrizione: string
          id?: string
          note?: string | null
          officina?: string | null
          property_mobile_id: string
          prossima_manutenzione?: string | null
          tipo: Database["public"]["Enums"]["maintenance_type"]
        }
        Update: {
          chilometraggio?: number | null
          costo?: number
          created_at?: string
          data_manutenzione?: string
          descrizione?: string
          id?: string
          note?: string | null
          officina?: string | null
          property_mobile_id?: string
          prossima_manutenzione?: string | null
          tipo?: Database["public"]["Enums"]["maintenance_type"]
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_property_mobile_id_fkey"
            columns: ["property_mobile_id"]
            isOneToOne: false
            referencedRelation: "properties_mobile"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          activity_id: string | null
          created_at: string
          data_invio: string | null
          data_scadenza: string
          document_id: string | null
          giorni_preavviso: number | null
          id: string
          inviata: boolean | null
          messaggio: string
          payment_id: string | null
          priorita: string | null
          property_mobile_id: string | null
          property_real_id: string | null
          tipo: string
          titolo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          data_invio?: string | null
          data_scadenza: string
          document_id?: string | null
          giorni_preavviso?: number | null
          id?: string
          inviata?: boolean | null
          messaggio: string
          payment_id?: string | null
          priorita?: string | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          tipo: string
          titolo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          data_invio?: string | null
          data_scadenza?: string
          document_id?: string | null
          giorni_preavviso?: number | null
          id?: string
          inviata?: boolean | null
          messaggio?: string
          payment_id?: string | null
          priorita?: string | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          tipo?: string
          titolo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_property_mobile_id_fkey"
            columns: ["property_mobile_id"]
            isOneToOne: false
            referencedRelation: "properties_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_property_real_id_fkey"
            columns: ["property_real_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_property_real_id_fkey"
            columns: ["property_real_id"]
            isOneToOne: false
            referencedRelation: "property_performance"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          created_at: string
          data_pagamento: string
          id: string
          importo_pagato: number
          metodo_pagamento: string | null
          note: string | null
          payment_id: string
        }
        Insert: {
          created_at?: string
          data_pagamento?: string
          id?: string
          importo_pagato: number
          metodo_pagamento?: string | null
          note?: string | null
          payment_id: string
        }
        Update: {
          created_at?: string
          data_pagamento?: string
          id?: string
          importo_pagato?: number
          metodo_pagamento?: string | null
          note?: string | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          categoria: Database["public"]["Enums"]["payment_category"] | null
          created_at: string
          data_pagamento: string | null
          descrizione: string
          escalation_applica_ogni_anno: boolean | null
          escalation_attiva: boolean | null
          escalation_percentuale: number | null
          fornitore: string | null
          id: string
          importo: number
          importo_originale: number
          metodo_pagamento: string | null
          property_mobile_id: string | null
          property_real_id: string | null
          ricorrenza_tipo: Database["public"]["Enums"]["payment_recurrence"]
          scadenza: string
          stato: Database["public"]["Enums"]["payment_status"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["payment_category"] | null
          created_at?: string
          data_pagamento?: string | null
          descrizione: string
          escalation_applica_ogni_anno?: boolean | null
          escalation_attiva?: boolean | null
          escalation_percentuale?: number | null
          fornitore?: string | null
          id?: string
          importo: number
          importo_originale: number
          metodo_pagamento?: string | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          ricorrenza_tipo?: Database["public"]["Enums"]["payment_recurrence"]
          scadenza: string
          stato?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["payment_category"] | null
          created_at?: string
          data_pagamento?: string | null
          descrizione?: string
          escalation_applica_ogni_anno?: boolean | null
          escalation_attiva?: boolean | null
          escalation_percentuale?: number | null
          fornitore?: string | null
          id?: string
          importo?: number
          importo_originale?: number
          metodo_pagamento?: string | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          ricorrenza_tipo?: Database["public"]["Enums"]["payment_recurrence"]
          scadenza?: string
          stato?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_property_mobile_id_fkey"
            columns: ["property_mobile_id"]
            isOneToOne: false
            referencedRelation: "properties_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_property_real_id_fkey"
            columns: ["property_real_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_property_real_id_fkey"
            columns: ["property_real_id"]
            isOneToOne: false
            referencedRelation: "property_performance"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties_mobile: {
        Row: {
          anno: number | null
          categoria: Database["public"]["Enums"]["mobile_category"]
          chilometraggio: number | null
          codice_identificativo: string | null
          consumo_medio: number | null
          costi_manutenzione_annuali: number | null
          costo_per_km: number | null
          created_at: string
          id: string
          marca: string | null
          modello: string | null
          nome: string
          numero_immatricolazione: string | null
          numero_serie: string | null
          numero_telaio: string | null
          porto_stazionamento: string | null
          proprietario_legale: string | null
          quota_possesso: number | null
          stato: string | null
          targa: string | null
          updated_at: string
          user_id: string
          valore_acquisto: number | null
          valore_attuale: number | null
        }
        Insert: {
          anno?: number | null
          categoria: Database["public"]["Enums"]["mobile_category"]
          chilometraggio?: number | null
          codice_identificativo?: string | null
          consumo_medio?: number | null
          costi_manutenzione_annuali?: number | null
          costo_per_km?: number | null
          created_at?: string
          id?: string
          marca?: string | null
          modello?: string | null
          nome: string
          numero_immatricolazione?: string | null
          numero_serie?: string | null
          numero_telaio?: string | null
          porto_stazionamento?: string | null
          proprietario_legale?: string | null
          quota_possesso?: number | null
          stato?: string | null
          targa?: string | null
          updated_at?: string
          user_id: string
          valore_acquisto?: number | null
          valore_attuale?: number | null
        }
        Update: {
          anno?: number | null
          categoria?: Database["public"]["Enums"]["mobile_category"]
          chilometraggio?: number | null
          codice_identificativo?: string | null
          consumo_medio?: number | null
          costi_manutenzione_annuali?: number | null
          costo_per_km?: number | null
          created_at?: string
          id?: string
          marca?: string | null
          modello?: string | null
          nome?: string
          numero_immatricolazione?: string | null
          numero_serie?: string | null
          numero_telaio?: string | null
          porto_stazionamento?: string | null
          proprietario_legale?: string | null
          quota_possesso?: number | null
          stato?: string | null
          targa?: string | null
          updated_at?: string
          user_id?: string
          valore_acquisto?: number | null
          valore_attuale?: number | null
        }
        Relationships: []
      }
      properties_real: {
        Row: {
          anno_costruzione: number | null
          canone_mensile: number | null
          cap: string
          citta: string
          codice_identificativo: string | null
          contatto_inquilino: string | null
          costi_gestione_annuali: number | null
          created_at: string
          data_fine_contratto: string | null
          data_inizio_contratto: string | null
          id: string
          inquilino: string | null
          metri_quadrati: number | null
          nome: string
          numero_vani: number | null
          proprietario_legale: string | null
          provincia: string
          quota_possesso: number | null
          rendita: number | null
          stato: string | null
          stato_conservazione:
            | Database["public"]["Enums"]["property_status"]
            | null
          tipo: Database["public"]["Enums"]["property_type"]
          updated_at: string
          user_id: string
          valore_acquisto: number | null
          valore_catastale: number | null
          via: string
        }
        Insert: {
          anno_costruzione?: number | null
          canone_mensile?: number | null
          cap: string
          citta: string
          codice_identificativo?: string | null
          contatto_inquilino?: string | null
          costi_gestione_annuali?: number | null
          created_at?: string
          data_fine_contratto?: string | null
          data_inizio_contratto?: string | null
          id?: string
          inquilino?: string | null
          metri_quadrati?: number | null
          nome: string
          numero_vani?: number | null
          proprietario_legale?: string | null
          provincia: string
          quota_possesso?: number | null
          rendita?: number | null
          stato?: string | null
          stato_conservazione?:
            | Database["public"]["Enums"]["property_status"]
            | null
          tipo: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          user_id: string
          valore_acquisto?: number | null
          valore_catastale?: number | null
          via: string
        }
        Update: {
          anno_costruzione?: number | null
          canone_mensile?: number | null
          cap?: string
          citta?: string
          codice_identificativo?: string | null
          contatto_inquilino?: string | null
          costi_gestione_annuali?: number | null
          created_at?: string
          data_fine_contratto?: string | null
          data_inizio_contratto?: string | null
          id?: string
          inquilino?: string | null
          metri_quadrati?: number | null
          nome?: string
          numero_vani?: number | null
          proprietario_legale?: string | null
          provincia?: string
          quota_possesso?: number | null
          rendita?: number | null
          stato?: string | null
          stato_conservazione?:
            | Database["public"]["Enums"]["property_status"]
            | null
          tipo?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          user_id?: string
          valore_acquisto?: number | null
          valore_catastale?: number | null
          via?: string
        }
        Relationships: []
      }
      refueling: {
        Row: {
          chilometraggio: number | null
          costo_per_litro: number
          costo_totale: number
          created_at: string
          data_rifornimento: string
          id: string
          litri: number
          note: string | null
          property_mobile_id: string
          stazione_servizio: string | null
          tipo_carburante: Database["public"]["Enums"]["fuel_type"]
        }
        Insert: {
          chilometraggio?: number | null
          costo_per_litro: number
          costo_totale: number
          created_at?: string
          data_rifornimento?: string
          id?: string
          litri: number
          note?: string | null
          property_mobile_id: string
          stazione_servizio?: string | null
          tipo_carburante?: Database["public"]["Enums"]["fuel_type"]
        }
        Update: {
          chilometraggio?: number | null
          costo_per_litro?: number
          costo_totale?: number
          created_at?: string
          data_rifornimento?: string
          id?: string
          litri?: number
          note?: string | null
          property_mobile_id?: string
          stazione_servizio?: string | null
          tipo_carburante?: Database["public"]["Enums"]["fuel_type"]
        }
        Relationships: [
          {
            foreignKeyName: "refueling_property_mobile_id_fkey"
            columns: ["property_mobile_id"]
            isOneToOne: false
            referencedRelation: "properties_mobile"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      property_performance: {
        Row: {
          canone_mensile: number | null
          codice_identificativo: string | null
          id: string | null
          nome: string | null
          reddito_annuale: number | null
          reddito_netto_annuale: number | null
          reddito_teorico_annuale: number | null
          roi_percentuale: number | null
          spese_annuali: number | null
          stato: string | null
          valore_acquisto: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_property_code: {
        Args: { property_type: string; user_id: string }
        Returns: string
      }
    }
    Enums: {
      activity_type: "manutenzione" | "pulizia" | "ispezione" | "generale"
      document_type:
        | "contratto"
        | "assicurazione"
        | "certificato"
        | "fattura"
        | "libretto"
        | "altro"
      fuel_type: "benzina" | "diesel" | "gpl" | "metano" | "elettrico"
      maintenance_type:
        | "tagliando"
        | "revisione"
        | "riparazione"
        | "sostituzione_parti"
      mobile_category: "veicolo" | "imbarcazione" | "attrezzatura"
      payment_category:
        | "condominio"
        | "tasse"
        | "assicurazione"
        | "bollo"
        | "manutenzione"
        | "altro"
      payment_recurrence: "mensile" | "trimestrale" | "semestrale" | "annuale"
      payment_status: "in_attesa" | "pagato" | "scaduto" | "parzialmente_pagato"
      priority_level: "alta" | "media" | "bassa"
      property_status: "ottimo" | "buono" | "discreto" | "da_ristrutturare"
      property_type: "appartamento" | "casa" | "ufficio" | "magazzino"
      recurrence_type:
        | "giornaliera"
        | "settimanale"
        | "mensile"
        | "trimestrale"
        | "semestrale"
        | "annuale"
        | "personalizzata"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: ["manutenzione", "pulizia", "ispezione", "generale"],
      document_type: [
        "contratto",
        "assicurazione",
        "certificato",
        "fattura",
        "libretto",
        "altro",
      ],
      fuel_type: ["benzina", "diesel", "gpl", "metano", "elettrico"],
      maintenance_type: [
        "tagliando",
        "revisione",
        "riparazione",
        "sostituzione_parti",
      ],
      mobile_category: ["veicolo", "imbarcazione", "attrezzatura"],
      payment_category: [
        "condominio",
        "tasse",
        "assicurazione",
        "bollo",
        "manutenzione",
        "altro",
      ],
      payment_recurrence: ["mensile", "trimestrale", "semestrale", "annuale"],
      payment_status: ["in_attesa", "pagato", "scaduto", "parzialmente_pagato"],
      priority_level: ["alta", "media", "bassa"],
      property_status: ["ottimo", "buono", "discreto", "da_ristrutturare"],
      property_type: ["appartamento", "casa", "ufficio", "magazzino"],
      recurrence_type: [
        "giornaliera",
        "settimanale",
        "mensile",
        "trimestrale",
        "semestrale",
        "annuale",
        "personalizzata",
      ],
    },
  },
} as const
