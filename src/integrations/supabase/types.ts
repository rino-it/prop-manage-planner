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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          assigned_to: string[] | null
          booking_id: string | null
          created_at: string
          descrizione: string | null
          id: string
          nome: string
          priorita: Database["public"]["Enums"]["priority_level"] | null
          property_mobile_id: string | null
          property_real_id: string | null
          quote_amount: number | null
          quote_status: string | null
          quote_url: string | null
          stato: string | null
          tipo: Database["public"]["Enums"]["activity_type"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string[] | null
          booking_id?: string | null
          created_at?: string
          descrizione?: string | null
          id?: string
          nome: string
          priorita?: Database["public"]["Enums"]["priority_level"] | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          quote_amount?: number | null
          quote_status?: string | null
          quote_url?: string | null
          stato?: string | null
          tipo?: Database["public"]["Enums"]["activity_type"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string[] | null
          booking_id?: string | null
          created_at?: string
          descrizione?: string | null
          id?: string
          nome?: string
          priorita?: Database["public"]["Enums"]["priority_level"] | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          quote_amount?: number | null
          quote_status?: string | null
          quote_url?: string | null
          stato?: string | null
          tipo?: Database["public"]["Enums"]["activity_type"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
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
        ]
      }
      ai_digest_log: {
        Row: {
          bookings_count: number | null
          created_at: string | null
          digest_text: string
          documents_count: number | null
          id: string
          payments_count: number | null
          sent_email: boolean | null
          sent_whatsapp: boolean | null
          tickets_count: number | null
        }
        Insert: {
          bookings_count?: number | null
          created_at?: string | null
          digest_text: string
          documents_count?: number | null
          id?: string
          payments_count?: number | null
          sent_email?: boolean | null
          sent_whatsapp?: boolean | null
          tickets_count?: number | null
        }
        Update: {
          bookings_count?: number | null
          created_at?: string | null
          digest_text?: string
          documents_count?: number | null
          id?: string
          payments_count?: number | null
          sent_email?: boolean | null
          sent_whatsapp?: boolean | null
          tickets_count?: number | null
        }
        Relationships: []
      }
      booking_documents: {
        Row: {
          ai_analyzed_at: string | null
          ai_doc_expiry: string | null
          ai_doc_number: string | null
          ai_doc_type: string | null
          ai_extracted_cf: string | null
          ai_extracted_name: string | null
          booking_id: string | null
          file_url: string
          filename: string
          id: string
          status: string | null
          uploaded_at: string | null
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_doc_expiry?: string | null
          ai_doc_number?: string | null
          ai_doc_type?: string | null
          ai_extracted_cf?: string | null
          ai_extracted_name?: string | null
          booking_id?: string | null
          file_url: string
          filename: string
          id?: string
          status?: string | null
          uploaded_at?: string | null
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_doc_expiry?: string | null
          ai_doc_number?: string | null
          ai_doc_type?: string | null
          ai_extracted_cf?: string | null
          ai_extracted_name?: string | null
          booking_id?: string | null
          file_url?: string
          filename?: string
          id?: string
          status?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          checkin_email_sent: boolean | null
          checkin_status: string | null
          codice_fiscale_ospite: string | null
          created_at: string | null
          data_fine: string
          data_inizio: string
          documenti_caricati: boolean | null
          documenti_url: string | null
          documents_approved: boolean | null
          email_ospite: string | null
          external_uid: string | null
          guest_email: string | null
          guest_phone: string | null
          id: string
          importo_totale: number | null
          nome_ospite: string
          numero_ospiti: number | null
          online_checkin_completed: boolean | null
          payment_schedule_generated: boolean | null
          property_id: string | null
          source: string | null
          stato_documenti: string | null
          telefono_ospite: string | null
          tipo_affitto: string | null
          total_amount: number | null
          updated_at: string | null
          user_id: string | null
          welcome_email_sent: boolean | null
          whatsapp_phone: string | null
        }
        Insert: {
          checkin_email_sent?: boolean | null
          checkin_status?: string | null
          codice_fiscale_ospite?: string | null
          created_at?: string | null
          data_fine: string
          data_inizio: string
          documenti_caricati?: boolean | null
          documenti_url?: string | null
          documents_approved?: boolean | null
          email_ospite?: string | null
          external_uid?: string | null
          guest_email?: string | null
          guest_phone?: string | null
          id?: string
          importo_totale?: number | null
          nome_ospite: string
          numero_ospiti?: number | null
          online_checkin_completed?: boolean | null
          payment_schedule_generated?: boolean | null
          property_id?: string | null
          source?: string | null
          stato_documenti?: string | null
          telefono_ospite?: string | null
          tipo_affitto?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
          welcome_email_sent?: boolean | null
          whatsapp_phone?: string | null
        }
        Update: {
          checkin_email_sent?: boolean | null
          checkin_status?: string | null
          codice_fiscale_ospite?: string | null
          created_at?: string | null
          data_fine?: string
          data_inizio?: string
          documenti_caricati?: boolean | null
          documenti_url?: string | null
          documents_approved?: boolean | null
          email_ospite?: string | null
          external_uid?: string | null
          guest_email?: string | null
          guest_phone?: string | null
          id?: string
          importo_totale?: number | null
          nome_ospite?: string
          numero_ospiti?: number | null
          online_checkin_completed?: boolean | null
          payment_schedule_generated?: boolean | null
          property_id?: string | null
          source?: string | null
          stato_documenti?: string | null
          telefono_ospite?: string | null
          tipo_affitto?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
          welcome_email_sent?: boolean | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          data_caricamento: string | null
          data_riferimento: string | null
          dimensione: number | null
          expense_id: string | null
          formato: string | null
          id: string
          importo: number | null
          nome: string
          payment_id: string | null
          property_mobile_id: string | null
          property_real_id: string | null
          tipo: string | null
          updated_at: string | null
          url: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_caricamento?: string | null
          data_riferimento?: string | null
          dimensione?: number | null
          expense_id?: string | null
          formato?: string | null
          id?: string
          importo?: number | null
          nome: string
          payment_id?: string | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          tipo?: string | null
          updated_at?: string | null
          url: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_caricamento?: string | null
          data_riferimento?: string | null
          dimensione?: number | null
          expense_id?: string | null
          formato?: string | null
          id?: string
          importo?: number | null
          nome?: string
          payment_id?: string | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          tipo?: string | null
          updated_at?: string | null
          url?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "property_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
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
        ]
      }
      email_log: {
        Row: {
          booking_id: string | null
          error_message: string | null
          id: string
          recipient_email: string
          sent_at: string | null
          status: string | null
          subject: string | null
          template_type: string
        }
        Insert: {
          booking_id?: string | null
          error_message?: string | null
          id?: string
          recipient_email: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_type: string
        }
        Update: {
          booking_id?: string | null
          error_message?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_sync_log: {
        Row: {
          bookings_created: number | null
          errors: string | null
          events_found: number | null
          id: string
          property_id: string | null
          synced_at: string | null
        }
        Insert: {
          bookings_created?: number | null
          errors?: string | null
          events_found?: number | null
          id?: string
          property_id?: string | null
          synced_at?: string | null
        }
        Update: {
          bookings_created?: number | null
          errors?: string | null
          events_found?: number | null
          id?: string
          property_id?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ical_sync_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
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
      maintenance_expenses: {
        Row: {
          amount: number
          created_at: string | null
          date: string | null
          description: string | null
          id: string
          property_id: string | null
          supplier: string | null
          ticket_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          property_id?: string | null
          supplier?: string | null
          ticket_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          property_id?: string | null
          supplier?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_expenses_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          booking_id: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          content: string
          created_at: string
          id: string
          metadata: Json | null
          property_id: string | null
          read: boolean
          sender_type: Database["public"]["Enums"]["sender_type"]
          template_key: string | null
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          property_id?: string | null
          read?: boolean
          sender_type?: Database["public"]["Enums"]["sender_type"]
          template_key?: string | null
          user_id: string
        }
        Update: {
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          property_id?: string | null
          read?: boolean
          sender_type?: Database["public"]["Enums"]["sender_type"]
          template_key?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          ticket_id: string | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          ticket_id?: string | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          ticket_id?: string | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          brand_color: string | null
          brand_logo_url: string | null
          caparra_due_days: number | null
          caparra_percentage: number | null
          cauzione_amount: number | null
          cauzione_preauth_days_before: number | null
          cauzione_release_days_after: number | null
          checkin_email_days_before: number | null
          created_at: string | null
          email_from_name: string | null
          email_reply_to: string | null
          id: string
          property_id: string | null
          reminder_days_before: number | null
          saldo_due_days_before: number | null
          stripe_account_id: string | null
          stripe_configured: boolean | null
          tassa_soggiorno_per_night: number | null
          tassa_soggiorno_per_person: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          brand_color?: string | null
          brand_logo_url?: string | null
          caparra_due_days?: number | null
          caparra_percentage?: number | null
          cauzione_amount?: number | null
          cauzione_preauth_days_before?: number | null
          cauzione_release_days_after?: number | null
          checkin_email_days_before?: number | null
          created_at?: string | null
          email_from_name?: string | null
          email_reply_to?: string | null
          id?: string
          property_id?: string | null
          reminder_days_before?: number | null
          saldo_due_days_before?: number | null
          stripe_account_id?: string | null
          stripe_configured?: boolean | null
          tassa_soggiorno_per_night?: number | null
          tassa_soggiorno_per_person?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          brand_color?: string | null
          brand_logo_url?: string | null
          caparra_due_days?: number | null
          caparra_percentage?: number | null
          cauzione_amount?: number | null
          cauzione_preauth_days_before?: number | null
          cauzione_release_days_after?: number | null
          checkin_email_days_before?: number | null
          created_at?: string | null
          email_from_name?: string | null
          email_reply_to?: string | null
          id?: string
          property_id?: string | null
          reminder_days_before?: number | null
          saldo_due_days_before?: number | null
          stripe_account_id?: string | null
          stripe_configured?: boolean | null
          tassa_soggiorno_per_night?: number | null
          tassa_soggiorno_per_person?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_settings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          allegato_url: string | null
          categoria: string | null
          competence: string | null
          created_at: string
          data_pagamento: string | null
          descrizione: string
          escalation_applica_ogni_anno: boolean | null
          escalation_attiva: boolean | null
          escalation_percentuale: number | null
          fornitore: string | null
          id: string
          importo: number
          importo_originale: number | null
          metodo_pagamento: string | null
          note: string | null
          payment_method: string | null
          payment_status: string | null
          property_mobile_id: string | null
          property_real_id: string | null
          ricorrenza_tipo: string
          scadenza: string
          stato: string | null
          ticket_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allegato_url?: string | null
          categoria?: string | null
          competence?: string | null
          created_at?: string
          data_pagamento?: string | null
          descrizione: string
          escalation_applica_ogni_anno?: boolean | null
          escalation_attiva?: boolean | null
          escalation_percentuale?: number | null
          fornitore?: string | null
          id?: string
          importo: number
          importo_originale?: number | null
          metodo_pagamento?: string | null
          note?: string | null
          payment_method?: string | null
          payment_status?: string | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          ricorrenza_tipo?: string
          scadenza: string
          stato?: string | null
          ticket_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allegato_url?: string | null
          categoria?: string | null
          competence?: string | null
          created_at?: string
          data_pagamento?: string | null
          descrizione?: string
          escalation_applica_ogni_anno?: boolean | null
          escalation_attiva?: boolean | null
          escalation_percentuale?: number | null
          fornitore?: string | null
          id?: string
          importo?: number
          importo_originale?: number | null
          metodo_pagamento?: string | null
          note?: string | null
          payment_method?: string | null
          payment_status?: string | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          ricorrenza_tipo?: string
          scadenza?: string
          stato?: string | null
          ticket_id?: string | null
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
            foreignKeyName: "payments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_connections: {
        Row: {
          api_credentials: Json | null
          connection_type: string
          created_at: string | null
          ical_url: string | null
          id: string
          last_sync: string | null
          last_sync_result: Json | null
          portal_name: string
          property_id: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          api_credentials?: Json | null
          connection_type?: string
          created_at?: string | null
          ical_url?: string | null
          id?: string
          last_sync?: string | null
          last_sync_result?: Json | null
          portal_name: string
          property_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          api_credentials?: Json | null
          connection_type?: string
          created_at?: string | null
          ical_url?: string | null
          id?: string
          last_sync?: string | null
          last_sync_result?: Json | null
          portal_name?: string
          property_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_connections_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          base_price: number
          created_at: string
          id: string
          max_price: number | null
          min_price: number | null
          notes: string | null
          property_id: string
          season_adjustments: Json | null
          strategy: string
          updated_at: string
          user_id: string
          weekend_adjustment: number | null
        }
        Insert: {
          base_price?: number
          created_at?: string
          id?: string
          max_price?: number | null
          min_price?: number | null
          notes?: string | null
          property_id: string
          season_adjustments?: Json | null
          strategy?: string
          updated_at?: string
          user_id?: string
          weekend_adjustment?: number | null
        }
        Update: {
          base_price?: number
          created_at?: string
          id?: string
          max_price?: number | null
          min_price?: number | null
          notes?: string | null
          property_id?: string
          season_adjustments?: Json | null
          strategy?: string
          updated_at?: string
          user_id?: string
          weekend_adjustment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved: boolean | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: string | null
          status: string | null
        }
        Insert: {
          approved?: boolean | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
        }
        Update: {
          approved?: boolean | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
        }
        Relationships: []
      }
      properties_mobile: {
        Row: {
          anno: number | null
          categoria: string | null
          codice_identificativo: string | null
          costo_per_km: number | null
          created_at: string | null
          data_revisione: string | null
          description: string | null
          id: string
          insurance_url: string | null
          km: number | null
          libretto_url: string | null
          marca: string | null
          modello: string | null
          nome: string | null
          note: string | null
          proprietario: string | null
          scadenza_assicurazione: string | null
          scadenza_bollo: string | null
          scadenza_revisione: string | null
          stato: string | null
          status: string | null
          targa: string | null
          tipo_carburante: string | null
          type: string | null
          updated_at: string | null
          user_id: string
          valore_acquisto: number | null
          valore_attuale: number | null
          veicolo: string | null
        }
        Insert: {
          anno?: number | null
          categoria?: string | null
          codice_identificativo?: string | null
          costo_per_km?: number | null
          created_at?: string | null
          data_revisione?: string | null
          description?: string | null
          id?: string
          insurance_url?: string | null
          km?: number | null
          libretto_url?: string | null
          marca?: string | null
          modello?: string | null
          nome?: string | null
          note?: string | null
          proprietario?: string | null
          scadenza_assicurazione?: string | null
          scadenza_bollo?: string | null
          scadenza_revisione?: string | null
          stato?: string | null
          status?: string | null
          targa?: string | null
          tipo_carburante?: string | null
          type?: string | null
          updated_at?: string | null
          user_id: string
          valore_acquisto?: number | null
          valore_attuale?: number | null
          veicolo?: string | null
        }
        Update: {
          anno?: number | null
          categoria?: string | null
          codice_identificativo?: string | null
          costo_per_km?: number | null
          created_at?: string | null
          data_revisione?: string | null
          description?: string | null
          id?: string
          insurance_url?: string | null
          km?: number | null
          libretto_url?: string | null
          marca?: string | null
          modello?: string | null
          nome?: string | null
          note?: string | null
          proprietario?: string | null
          scadenza_assicurazione?: string | null
          scadenza_bollo?: string | null
          scadenza_revisione?: string | null
          stato?: string | null
          status?: string | null
          targa?: string | null
          tipo_carburante?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string
          valore_acquisto?: number | null
          valore_attuale?: number | null
          veicolo?: string | null
        }
        Relationships: []
      }
      properties_real: {
        Row: {
          ascensore: boolean | null
          cap: string | null
          checkin_guide: string | null
          checkin_video_url: string | null
          citta: string | null
          codice_keybox: string | null
          created_at: string | null
          ical_url: string | null
          id: string
          indirizzo: string | null
          istruzioni_checkin: string | null
          keybox_code: string | null
          latitude: number | null
          longitude: number | null
          mq: number | null
          nome: string
          piano: string | null
          provincia: string | null
          rendita: number | null
          staff_token: string | null
          stato: string | null
          stato_conservazione: string | null
          tipo: string | null
          tipo_affitto: string | null
          user_id: string | null
          valore_acquisto: number | null
          valore_catastale: number | null
          vani: number | null
          via: string | null
          wifi_password: string | null
          wifi_ssid: string | null
        }
        Insert: {
          ascensore?: boolean | null
          cap?: string | null
          checkin_guide?: string | null
          checkin_video_url?: string | null
          citta?: string | null
          codice_keybox?: string | null
          created_at?: string | null
          ical_url?: string | null
          id?: string
          indirizzo?: string | null
          istruzioni_checkin?: string | null
          keybox_code?: string | null
          latitude?: number | null
          longitude?: number | null
          mq?: number | null
          nome: string
          piano?: string | null
          provincia?: string | null
          rendita?: number | null
          staff_token?: string | null
          stato?: string | null
          stato_conservazione?: string | null
          tipo?: string | null
          tipo_affitto?: string | null
          user_id?: string | null
          valore_acquisto?: number | null
          valore_catastale?: number | null
          vani?: number | null
          via?: string | null
          wifi_password?: string | null
          wifi_ssid?: string | null
        }
        Update: {
          ascensore?: boolean | null
          cap?: string | null
          checkin_guide?: string | null
          checkin_video_url?: string | null
          citta?: string | null
          codice_keybox?: string | null
          created_at?: string | null
          ical_url?: string | null
          id?: string
          indirizzo?: string | null
          istruzioni_checkin?: string | null
          keybox_code?: string | null
          latitude?: number | null
          longitude?: number | null
          mq?: number | null
          nome?: string
          piano?: string | null
          provincia?: string | null
          rendita?: number | null
          staff_token?: string | null
          stato?: string | null
          stato_conservazione?: string | null
          tipo?: string | null
          tipo_affitto?: string | null
          user_id?: string | null
          valore_acquisto?: number | null
          valore_catastale?: number | null
          vani?: number | null
          via?: string | null
          wifi_password?: string | null
          wifi_ssid?: string | null
        }
        Relationships: []
      }
      property_blocked_dates: {
        Row: {
          created_at: string | null
          date_end: string
          date_start: string
          external_uid: string | null
          id: string
          property_id: string
          reason: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_end: string
          date_start: string
          external_uid?: string | null
          id?: string
          property_id: string
          reason?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_end?: string
          date_start?: string
          external_uid?: string | null
          id?: string
          property_id?: string
          reason?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_blocked_dates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
        ]
      }
      property_expenses: {
        Row: {
          amount: number
          assigned_to: string | null
          attachment_url: string | null
          category: string | null
          charged_to_tenant: boolean | null
          created_at: string | null
          date: string
          description: string | null
          id: string
          property_id: string | null
          status: string | null
          supplier: string | null
          supplier_contact: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          assigned_to?: string | null
          attachment_url?: string | null
          category?: string | null
          charged_to_tenant?: boolean | null
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          property_id?: string | null
          status?: string | null
          supplier?: string | null
          supplier_contact?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          attachment_url?: string | null
          category?: string | null
          charged_to_tenant?: boolean | null
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          property_id?: string | null
          status?: string | null
          supplier?: string | null
          supplier_contact?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_expenses_profiles"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
        ]
      }
      refueling: {
        Row: {
          costo_per_litro: number
          costo_totale: number
          created_at: string
          data_rifornimento: string
          id: string
          litri: number
          property_mobile_id: string
          tipo_carburante: Database["public"]["Enums"]["fuel_type"]
        }
        Insert: {
          costo_per_litro: number
          costo_totale: number
          created_at?: string
          data_rifornimento?: string
          id?: string
          litri: number
          property_mobile_id: string
          tipo_carburante?: Database["public"]["Enums"]["fuel_type"]
        }
        Update: {
          costo_per_litro?: number
          costo_totale?: number
          created_at?: string
          data_rifornimento?: string
          id?: string
          litri?: number
          property_mobile_id?: string
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
      revenue_entries: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          date: string | null
          description: string | null
          id: string
          property_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          property_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          property_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean | null
          attivo: boolean | null
          created_at: string | null
          description: string | null
          descrizione: string | null
          id: string
          image_url: string | null
          immagine_url: string | null
          indirizzo: string | null
          link_prenotazione: string | null
          payment_link: string | null
          prezzo: string | null
          price: number | null
          property_ids: string[] | null
          titolo: string
        }
        Insert: {
          active?: boolean | null
          attivo?: boolean | null
          created_at?: string | null
          description?: string | null
          descrizione?: string | null
          id?: string
          image_url?: string | null
          immagine_url?: string | null
          indirizzo?: string | null
          link_prenotazione?: string | null
          payment_link?: string | null
          prezzo?: string | null
          price?: number | null
          property_ids?: string[] | null
          titolo: string
        }
        Update: {
          active?: boolean | null
          attivo?: boolean | null
          created_at?: string | null
          description?: string | null
          descrizione?: string | null
          id?: string
          image_url?: string | null
          immagine_url?: string | null
          indirizzo?: string | null
          link_prenotazione?: string | null
          payment_link?: string | null
          prezzo?: string | null
          price?: number | null
          property_ids?: string[] | null
          titolo?: string
        }
        Relationships: []
      }
      sync_staging: {
        Row: {
          change_type: string
          connection_id: string
          created_at: string
          data_fine: string
          data_inizio: string
          email_ospite: string | null
          event_type: string
          existing_booking_id: string | null
          external_uid: string
          id: string
          nome_ospite: string | null
          numero_ospiti: number | null
          portal_name: string
          previous_data: Json | null
          property_id: string
          raw_summary: string | null
          reviewed_at: string | null
          source: string
          status: string
          sync_batch_id: string
          synced_at: string
          telefono_ospite: string | null
          tipo_affitto: string | null
          user_id: string
        }
        Insert: {
          change_type: string
          connection_id: string
          created_at?: string
          data_fine: string
          data_inizio: string
          email_ospite?: string | null
          event_type: string
          existing_booking_id?: string | null
          external_uid: string
          id?: string
          nome_ospite?: string | null
          numero_ospiti?: number | null
          portal_name: string
          previous_data?: Json | null
          property_id: string
          raw_summary?: string | null
          reviewed_at?: string | null
          source: string
          status?: string
          sync_batch_id: string
          synced_at?: string
          telefono_ospite?: string | null
          tipo_affitto?: string | null
          user_id: string
        }
        Update: {
          change_type?: string
          connection_id?: string
          created_at?: string
          data_fine?: string
          data_inizio?: string
          email_ospite?: string | null
          event_type?: string
          existing_booking_id?: string | null
          external_uid?: string
          id?: string
          nome_ospite?: string | null
          numero_ospiti?: number | null
          portal_name?: string
          previous_data?: Json | null
          property_id?: string
          raw_summary?: string | null
          reviewed_at?: string | null
          source?: string
          status?: string
          sync_batch_id?: string
          synced_at?: string
          telefono_ospite?: string | null
          tipo_affitto?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_staging_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "portal_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_staging_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payments: {
        Row: {
          booking_id: string | null
          category: Database["public"]["Enums"]["payment_category"] | null
          consumo_kw_mc: number | null
          created_at: string | null
          data_pagamento: string | null
          data_scadenza: string
          description: string | null
          documento_url: string | null
          email_sent: boolean | null
          id: string
          importo: number
          is_preauth: boolean | null
          is_recurring: boolean | null
          notes: string | null
          payment_date: string | null
          payment_date_declared: string | null
          payment_proof_url: string | null
          payment_type: string | null
          periodo_riferimento: string | null
          preauth_captured_amount: number | null
          preauth_reason: string | null
          preauth_released: boolean | null
          receipt_url: string | null
          recurrence_group_id: string | null
          stato: string | null
          stripe_checkout_url: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          tipo: string | null
          user_id: string | null
        }
        Insert: {
          booking_id?: string | null
          category?: Database["public"]["Enums"]["payment_category"] | null
          consumo_kw_mc?: number | null
          created_at?: string | null
          data_pagamento?: string | null
          data_scadenza: string
          description?: string | null
          documento_url?: string | null
          email_sent?: boolean | null
          id?: string
          importo: number
          is_preauth?: boolean | null
          is_recurring?: boolean | null
          notes?: string | null
          payment_date?: string | null
          payment_date_declared?: string | null
          payment_proof_url?: string | null
          payment_type?: string | null
          periodo_riferimento?: string | null
          preauth_captured_amount?: number | null
          preauth_reason?: string | null
          preauth_released?: boolean | null
          receipt_url?: string | null
          recurrence_group_id?: string | null
          stato?: string | null
          stripe_checkout_url?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tipo?: string | null
          user_id?: string | null
        }
        Update: {
          booking_id?: string | null
          category?: Database["public"]["Enums"]["payment_category"] | null
          consumo_kw_mc?: number | null
          created_at?: string | null
          data_pagamento?: string | null
          data_scadenza?: string
          description?: string | null
          documento_url?: string | null
          email_sent?: boolean | null
          id?: string
          importo?: number
          is_preauth?: boolean | null
          is_recurring?: boolean | null
          notes?: string | null
          payment_date?: string | null
          payment_date_declared?: string | null
          payment_proof_url?: string | null
          payment_type?: string | null
          periodo_riferimento?: string | null
          preauth_captured_amount?: number | null
          preauth_reason?: string | null
          preauth_released?: boolean | null
          receipt_url?: string | null
          recurrence_group_id?: string | null
          stato?: string | null
          stripe_checkout_url?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tipo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_profiles: {
        Row: {
          booking_id: string | null
          compliance_score: number | null
          created_at: string | null
          id: string
          owner_notes: string | null
          payment_reliability: number | null
          ticket_frequency: number | null
          updated_at: string | null
        }
        Insert: {
          booking_id?: string | null
          compliance_score?: number | null
          created_at?: string | null
          id?: string
          owner_notes?: string | null
          payment_reliability?: number | null
          ticket_frequency?: number | null
          updated_at?: string | null
        }
        Update: {
          booking_id?: string | null
          compliance_score?: number | null
          created_at?: string | null
          id?: string
          owner_notes?: string | null
          payment_reliability?: number | null
          ticket_frequency?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_profiles_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          admin_notes: string | null
          ai_categoria: string | null
          ai_confidence: number | null
          ai_priorita: string | null
          ai_suggerimento: string | null
          assigned_partner_id: string | null
          assigned_to: string[] | null
          attachments: string[] | null
          booking_id: string | null
          cost: number | null
          created_at: string | null
          creato_da: string | null
          data_scadenza: string | null
          descrizione: string | null
          foto_url: string | null
          id: string
          priorita: string | null
          promised_payment_date: string | null
          promised_payment_method: string | null
          property_mobile_id: string | null
          property_real_id: string | null
          quote_amount: number | null
          quote_status: string | null
          quote_url: string | null
          related_payment_id: string | null
          resolution_photo_url: string | null
          ricevuta_url: string | null
          scadenza: string | null
          share_notes: boolean | null
          source: string | null
          spesa_visibile_ospite: boolean | null
          stato: string | null
          supplier: string | null
          supplier_contact: string | null
          titolo: string
          user_id: string | null
          whatsapp_from: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          ai_categoria?: string | null
          ai_confidence?: number | null
          ai_priorita?: string | null
          ai_suggerimento?: string | null
          assigned_partner_id?: string | null
          assigned_to?: string[] | null
          attachments?: string[] | null
          booking_id?: string | null
          cost?: number | null
          created_at?: string | null
          creato_da?: string | null
          data_scadenza?: string | null
          descrizione?: string | null
          foto_url?: string | null
          id?: string
          priorita?: string | null
          promised_payment_date?: string | null
          promised_payment_method?: string | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          quote_amount?: number | null
          quote_status?: string | null
          quote_url?: string | null
          related_payment_id?: string | null
          resolution_photo_url?: string | null
          ricevuta_url?: string | null
          scadenza?: string | null
          share_notes?: boolean | null
          source?: string | null
          spesa_visibile_ospite?: boolean | null
          stato?: string | null
          supplier?: string | null
          supplier_contact?: string | null
          titolo: string
          user_id?: string | null
          whatsapp_from?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          ai_categoria?: string | null
          ai_confidence?: number | null
          ai_priorita?: string | null
          ai_suggerimento?: string | null
          assigned_partner_id?: string | null
          assigned_to?: string[] | null
          attachments?: string[] | null
          booking_id?: string | null
          cost?: number | null
          created_at?: string | null
          creato_da?: string | null
          data_scadenza?: string | null
          descrizione?: string | null
          foto_url?: string | null
          id?: string
          priorita?: string | null
          promised_payment_date?: string | null
          promised_payment_method?: string | null
          property_mobile_id?: string | null
          property_real_id?: string | null
          quote_amount?: number | null
          quote_status?: string | null
          quote_url?: string | null
          related_payment_id?: string | null
          resolution_photo_url?: string | null
          ricevuta_url?: string | null
          scadenza?: string | null
          share_notes?: boolean | null
          source?: string | null
          spesa_visibile_ospite?: boolean | null
          stato?: string | null
          supplier?: string | null
          supplier_contact?: string | null
          titolo?: string
          user_id?: string | null
          whatsapp_from?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_partner_id_fkey"
            columns: ["assigned_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_property_mobile_id_fkey"
            columns: ["property_mobile_id"]
            isOneToOne: false
            referencedRelation: "properties_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_property_real_id_fkey"
            columns: ["property_real_id"]
            isOneToOne: false
            referencedRelation: "properties_real"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_related_payment_id_fkey"
            columns: ["related_payment_id"]
            isOneToOne: false
            referencedRelation: "tenant_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          access_token: string
          created_at: string | null
          enabled: boolean | null
          id: string
          owner_whatsapp: string
          phone_number_id: string
          updated_at: string | null
          user_id: string | null
          verify_token: string
          waba_id: string
          webhook_secret: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          owner_whatsapp: string
          phone_number_id: string
          updated_at?: string | null
          user_id?: string | null
          verify_token: string
          waba_id: string
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          owner_whatsapp?: string
          phone_number_id?: string
          updated_at?: string | null
          user_id?: string | null
          verify_token?: string
          waba_id?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          booking_id: string | null
          created_at: string | null
          direction: string
          error_message: string | null
          from_number: string
          id: string
          media_url: string | null
          processed: boolean | null
          ticket_id: string | null
          to_number: string | null
          wa_message_id: string | null
        }
        Insert: {
          body?: string | null
          booking_id?: string | null
          created_at?: string | null
          direction: string
          error_message?: string | null
          from_number: string
          id?: string
          media_url?: string | null
          processed?: boolean | null
          ticket_id?: string | null
          to_number?: string | null
          wa_message_id?: string | null
        }
        Update: {
          body?: string | null
          booking_id?: string | null
          created_at?: string | null
          direction?: string
          error_message?: string | null
          from_number?: string
          id?: string
          media_url?: string | null
          processed?: boolean | null
          ticket_id?: string | null
          to_number?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_deadlines: { Args: never; Returns: undefined }
      get_secret: { Args: { secret_name: string }; Returns: string }
      hello_world: { Args: never; Returns: string }
    }
    Enums: {
      activity_type: "manutenzione" | "pulizia" | "ispezione" | "generale"
      fuel_type: "benzina" | "diesel" | "gpl" | "metano" | "elettrico"
      maintenance_type:
        | "tagliando"
        | "revisione"
        | "riparazione"
        | "sostituzione_parti"
      message_channel: "whatsapp" | "email" | "internal"
      mobile_category: "veicolo" | "imbarcazione" | "attrezzatura"
      payment_category:
        | "canone_locazione"
        | "rimborso_utenze"
        | "deposito_cauzionale"
        | "extra"
        | "altro"
        | "manutenzione"
      payment_recurrence:
        | "mensile"
        | "trimestrale"
        | "semestrale"
        | "annuale"
        | "una_tantum"
      payment_status: "in_attesa" | "pagato" | "scaduto" | "parzialmente_pagato"
      priority_level: "alta" | "media" | "bassa"
      sender_type: "host" | "guest" | "system"
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
      fuel_type: ["benzina", "diesel", "gpl", "metano", "elettrico"],
      maintenance_type: [
        "tagliando",
        "revisione",
        "riparazione",
        "sostituzione_parti",
      ],
      message_channel: ["whatsapp", "email", "internal"],
      mobile_category: ["veicolo", "imbarcazione", "attrezzatura"],
      payment_category: [
        "canone_locazione",
        "rimborso_utenze",
        "deposito_cauzionale",
        "extra",
        "altro",
        "manutenzione",
      ],
      payment_recurrence: [
        "mensile",
        "trimestrale",
        "semestrale",
        "annuale",
        "una_tantum",
      ],
      payment_status: ["in_attesa", "pagato", "scaduto", "parzialmente_pagato"],
      priority_level: ["alta", "media", "bassa"],
      sender_type: ["host", "guest", "system"],
    },
  },
} as const
