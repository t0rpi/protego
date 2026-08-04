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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_documents: {
        Row: {
          agent_id: string
          created_at: string
          expires_at: string | null
          file_path: string
          id: string
          status: Database["public"]["Enums"]["agent_document_status"]
          type: Database["public"]["Enums"]["agent_document_type"]
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          expires_at?: string | null
          file_path: string
          id?: string
          status?: Database["public"]["Enums"]["agent_document_status"]
          type: Database["public"]["Enums"]["agent_document_type"]
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          expires_at?: string | null
          file_path?: string
          id?: string
          status?: Database["public"]["Enums"]["agent_document_status"]
          type?: Database["public"]["Enums"]["agent_document_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_earnings: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          currency: string
          id: string
          mission_id: string
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string
          currency?: string
          id?: string
          mission_id: string
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          mission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_earnings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_earnings_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: true
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          badges: Json
          created_at: string
          iban: string | null
          id: string
          is_available: boolean
          rating: number | null
          source: Database["public"]["Enums"]["agent_source"]
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
        }
        Insert: {
          badges?: Json
          created_at?: string
          iban?: string | null
          id: string
          is_available?: boolean
          rating?: number | null
          source?: Database["public"]["Enums"]["agent_source"]
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Update: {
          badges?: Json
          created_at?: string
          iban?: string | null
          id?: string
          is_available?: boolean
          rating?: number | null
          source?: Database["public"]["Enums"]["agent_source"]
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      call_intents: {
        Row: {
          created_at: string
          id: string
          initiated_by: string
          mission_id: string | null
          purpose: string
          shield_event_id: string | null
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          initiated_by: string
          mission_id?: string | null
          purpose: string
          shield_event_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          initiated_by?: string
          mission_id?: string | null
          purpose?: string
          shield_event_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_intents_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_intents_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_intents_shield_event_id_fkey"
            columns: ["shield_event_id"]
            isOneToOne: false
            referencedRelation: "shield_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_intents_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          initiator_id: string
          mission_id: string | null
          split_strategy: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          initiator_id: string
          mission_id?: string | null
          split_strategy?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          initiator_id?: string
          mission_id?: string | null
          split_strategy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verifications: {
        Row: {
          created_at: string
          id: string
          id_card_path: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          selfie_path: string
          status: Database["public"]["Enums"]["identity_verification_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_card_path: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          selfie_path: string
          status?: Database["public"]["Enums"]["identity_verification_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          id_card_path?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          selfie_path?: string
          status?: Database["public"]["Enums"]["identity_verification_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          agent_id: string
          created_at: string
          description: string
          evidence: Json
          id: string
          incident_type: string
          mission_id: string
          severity: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          description: string
          evidence?: Json
          id?: string
          incident_type: string
          mission_id: string
          severity: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          description?: string
          evidence?: Json
          id?: string
          incident_type?: string
          mission_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_reports_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          mission_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          mission_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mission_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_chat_messages_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_offers: {
        Row: {
          agent_id: string
          created_at: string
          expires_at: string
          id: string
          mission_id: string
          offered_at: string
          responded_at: string | null
          status: Database["public"]["Enums"]["mission_offer_status"]
        }
        Insert: {
          agent_id: string
          created_at?: string
          expires_at?: string
          id?: string
          mission_id: string
          offered_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["mission_offer_status"]
        }
        Update: {
          agent_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          mission_id?: string
          offered_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["mission_offer_status"]
        }
        Relationships: [
          {
            foreignKeyName: "mission_offers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_offers_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_reports: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          mission_id: string
          summary: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          mission_id: string
          summary?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          mission_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_reports_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_reports_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: true
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_share_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          mission_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          mission_id: string
          revoked_at?: string | null
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          mission_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_share_links_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_tracking: {
        Row: {
          agent_id: string
          id: string
          lat: number
          lng: number
          mission_id: string
          recorded_at: string
        }
        Insert: {
          agent_id: string
          id?: string
          lat: number
          lng: number
          mission_id: string
          recorded_at?: string
        }
        Update: {
          agent_id?: string
          id?: string
          lat?: number
          lng?: number
          mission_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_tracking_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_tracking_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_vehicle_checklists: {
        Row: {
          client_signature_at: string | null
          consent_signed_at: string | null
          created_at: string
          insurance_confirmed: boolean
          mission_id: string
          photos: Json
          updated_at: string
        }
        Insert: {
          client_signature_at?: string | null
          consent_signed_at?: string | null
          created_at?: string
          insurance_confirmed?: boolean
          mission_id: string
          photos?: Json
          updated_at?: string
        }
        Update: {
          client_signature_at?: string | null
          consent_signed_at?: string | null
          created_at?: string
          insurance_confirmed?: boolean
          mission_id?: string
          photos?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_vehicle_checklists_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: true
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          accompany_inside_minutes: number | null
          agent_count: number
          agent_preference: Database["public"]["Enums"]["mission_agent_preference"]
          city: string
          client_id: string
          completed_at: string | null
          context_details: string | null
          context_kind: Database["public"]["Enums"]["mission_context_kind"]
          context_threat_known: boolean
          created_at: string
          destination_address: string | null
          distance_km: number | null
          dress_code: Database["public"]["Enums"]["mission_dress_code"]
          duration_hours: number | null
          elevated_priority: boolean
          id: string
          mobility: Database["public"]["Enums"]["mission_mobility"]
          pickup_address: string | null
          protected_person_id: string | null
          risk_level: string
          scheduled_at: string | null
          service_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["mission_status"]
          updated_at: string
          verification_code: string | null
          wait_at_destination_minutes: number | null
        }
        Insert: {
          accompany_inside_minutes?: number | null
          agent_count?: number
          agent_preference?: Database["public"]["Enums"]["mission_agent_preference"]
          city: string
          client_id: string
          completed_at?: string | null
          context_details?: string | null
          context_kind?: Database["public"]["Enums"]["mission_context_kind"]
          context_threat_known?: boolean
          created_at?: string
          destination_address?: string | null
          distance_km?: number | null
          dress_code?: Database["public"]["Enums"]["mission_dress_code"]
          duration_hours?: number | null
          elevated_priority?: boolean
          id?: string
          mobility?: Database["public"]["Enums"]["mission_mobility"]
          pickup_address?: string | null
          protected_person_id?: string | null
          risk_level?: string
          scheduled_at?: string | null
          service_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string
          verification_code?: string | null
          wait_at_destination_minutes?: number | null
        }
        Update: {
          accompany_inside_minutes?: number | null
          agent_count?: number
          agent_preference?: Database["public"]["Enums"]["mission_agent_preference"]
          city?: string
          client_id?: string
          completed_at?: string | null
          context_details?: string | null
          context_kind?: Database["public"]["Enums"]["mission_context_kind"]
          context_threat_known?: boolean
          created_at?: string
          destination_address?: string | null
          distance_km?: number | null
          dress_code?: Database["public"]["Enums"]["mission_dress_code"]
          duration_hours?: number | null
          elevated_priority?: boolean
          id?: string
          mobility?: Database["public"]["Enums"]["mission_mobility"]
          pickup_address?: string | null
          protected_person_id?: string | null
          risk_level?: string
          scheduled_at?: string | null
          service_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string
          verification_code?: string | null
          wait_at_destination_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_protected_person_id_fkey"
            columns: ["protected_person_id"]
            isOneToOne: false
            referencedRelation: "protected_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          event: Database["public"]["Enums"]["notification_event"]
          id: string
          mission_id: string | null
          payload: Json | null
          provider_status: string
          sent_at: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          event: Database["public"]["Enums"]["notification_event"]
          id?: string
          mission_id?: string | null
          payload?: Json | null
          provider_status?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          event?: Database["public"]["Enums"]["notification_event"]
          id?: string
          mission_id?: string | null
          payload?: Json | null
          provider_status?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          push_enabled: boolean
          sms_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          push_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          push_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          commission_rate: number | null
          company_name: string
          created_at: string
          id: string
          insurance: string | null
          license_no: string | null
        }
        Insert: {
          commission_rate?: number | null
          company_name: string
          created_at?: string
          id?: string
          insurance?: string | null
          license_no?: string | null
        }
        Update: {
          commission_rate?: number | null
          company_name?: string
          created_at?: string
          id?: string
          insurance?: string | null
          license_no?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          group_id: string | null
          id: string
          mission_id: string
          status: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id: string
          type: Database["public"]["Enums"]["payment_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          group_id?: string | null
          id?: string
          mission_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id: string
          type: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          group_id?: string | null
          id?: string
          mission_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string
          type?: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_batch_items: {
        Row: {
          agent_id: string
          amount: number
          batch_id: string
          created_at: string
          id: string
          missions_count: number
        }
        Insert: {
          agent_id: string
          amount: number
          batch_id: string
          created_at?: string
          id?: string
          missions_count: number
        }
        Update: {
          agent_id?: string
          amount?: number
          batch_id?: string
          created_at?: string
          id?: string
          missions_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "payout_batch_items_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_batches: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["payout_batch_status"]
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payout_batch_status"]
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payout_batch_status"]
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          accompany_inside_fee: number | null
          accompany_inside_hourly_threshold_minutes: number
          accompany_inside_included_minutes: number
          agent_minimum_per_mission: number | null
          agent_share_pct: number
          base: number
          cancellation_fee_minimum: number
          cancellation_fee_pct: number
          city: string
          coef_cap: number
          coef_night: number
          coef_urgent: number
          coef_weekend: number
          created_at: string
          default_distance_km: number | null
          degressive_rate: number
          degressive_threshold_hours: number | null
          door_to_door_included: boolean
          free_cancel_minutes: number
          id: string
          min_billing_hours: number
          minimum_total: number | null
          per_hour_agent: number
          per_hour_vehicle: number
          per_km: number
          platform_fee: number
          platform_fee_per_hour: number | null
          service_id: string
          updated_at: string
          vat_rate: number
          vehicle_included_km_per_hour: number | null
          vehicle_km_surcharge_rate: number | null
          wait_free_minutes: number
          wait_per_minute_rate: number | null
        }
        Insert: {
          accompany_inside_fee?: number | null
          accompany_inside_hourly_threshold_minutes?: number
          accompany_inside_included_minutes?: number
          agent_minimum_per_mission?: number | null
          agent_share_pct?: number
          base?: number
          cancellation_fee_minimum?: number
          cancellation_fee_pct?: number
          city: string
          coef_cap?: number
          coef_night?: number
          coef_urgent?: number
          coef_weekend?: number
          created_at?: string
          default_distance_km?: number | null
          degressive_rate?: number
          degressive_threshold_hours?: number | null
          door_to_door_included?: boolean
          free_cancel_minutes?: number
          id?: string
          min_billing_hours?: number
          minimum_total?: number | null
          per_hour_agent?: number
          per_hour_vehicle?: number
          per_km?: number
          platform_fee?: number
          platform_fee_per_hour?: number | null
          service_id: string
          updated_at?: string
          vat_rate?: number
          vehicle_included_km_per_hour?: number | null
          vehicle_km_surcharge_rate?: number | null
          wait_free_minutes?: number
          wait_per_minute_rate?: number | null
        }
        Update: {
          accompany_inside_fee?: number | null
          accompany_inside_hourly_threshold_minutes?: number
          accompany_inside_included_minutes?: number
          agent_minimum_per_mission?: number | null
          agent_share_pct?: number
          base?: number
          cancellation_fee_minimum?: number
          cancellation_fee_pct?: number
          city?: string
          coef_cap?: number
          coef_night?: number
          coef_urgent?: number
          coef_weekend?: number
          created_at?: string
          default_distance_km?: number | null
          degressive_rate?: number
          degressive_threshold_hours?: number | null
          door_to_door_included?: boolean
          free_cancel_minutes?: number
          id?: string
          min_billing_hours?: number
          minimum_total?: number | null
          per_hour_agent?: number
          per_hour_vehicle?: number
          per_km?: number
          platform_fee?: number
          platform_fee_per_hour?: number | null
          service_id?: string
          updated_at?: string
          vat_rate?: number
          vehicle_included_km_per_hour?: number | null
          vehicle_km_surcharge_rate?: number | null
          wait_free_minutes?: number
          wait_per_minute_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_config_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          stripe_customer_id: string | null
          updated_at: string
          verification_level: number
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          stripe_customer_id?: string | null
          updated_at?: string
          verification_level?: number
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          stripe_customer_id?: string | null
          updated_at?: string
          verification_level?: number
        }
        Relationships: []
      }
      protected_persons: {
        Row: {
          created_at: string
          date_of_birth: string | null
          full_name: string
          id: string
          owner_id: string
          relation: Database["public"]["Enums"]["protected_person_relation"]
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          id?: string
          owner_id: string
          relation?: Database["public"]["Enums"]["protected_person_relation"]
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          id?: string
          owner_id?: string
          relation?: Database["public"]["Enums"]["protected_person_relation"]
        }
        Relationships: [
          {
            foreignKeyName: "protected_persons_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          breakdown: Json
          created_at: string
          currency: string
          id: string
          kind: string
          labor_component: number
          mission_id: string
          total_estimate: number
        }
        Insert: {
          breakdown: Json
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          labor_component?: number
          mission_id: string
          total_estimate: number
        }
        Update: {
          breakdown?: Json
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          labor_component?: number
          mission_id?: string
          total_estimate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      service_city_status: {
        Row: {
          city: string
          created_at: string
          enabled: boolean
          service_id: string
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          enabled?: boolean
          service_id: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          enabled?: boolean
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_city_status_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
          updated_at: string
          wave: number
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
          updated_at?: string
          wave: number
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
          updated_at?: string
          wave?: number
        }
        Relationships: []
      }
      shield_contacts: {
        Row: {
          app_user_id: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          phone: string
        }
        Insert: {
          app_user_id?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          phone: string
        }
        Update: {
          app_user_id?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "shield_contacts_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shield_contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shield_events: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["shield_event_type"]
          id: string
          journal: string | null
          lat: number | null
          lng: number | null
          mission_id: string | null
          protocol_steps: Json
          resolved_at: string | null
          source: Database["public"]["Enums"]["shield_event_source"]
          status: Database["public"]["Enums"]["shield_event_status"]
          triggered_by: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["shield_event_type"]
          id?: string
          journal?: string | null
          lat?: number | null
          lng?: number | null
          mission_id?: string | null
          protocol_steps?: Json
          resolved_at?: string | null
          source: Database["public"]["Enums"]["shield_event_source"]
          status?: Database["public"]["Enums"]["shield_event_status"]
          triggered_by: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["shield_event_type"]
          id?: string
          journal?: string | null
          lat?: number | null
          lng?: number | null
          mission_id?: string | null
          protocol_steps?: Json
          resolved_at?: string | null
          source?: Database["public"]["Enums"]["shield_event_source"]
          status?: Database["public"]["Enums"]["shield_event_status"]
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "shield_events_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shield_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shield_events_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shield_locations: {
        Row: {
          id: string
          lat: number
          lng: number
          owner_id: string
          recorded_at: string
        }
        Insert: {
          id?: string
          lat: number
          lng: number
          owner_id: string
          recorded_at?: string
        }
        Update: {
          id?: string
          lat?: number
          lng?: number
          owner_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shield_locations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shield_share_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          owner_id: string
          revoked_at: string | null
          source_event_id: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          owner_id: string
          revoked_at?: string | null
          source_event_id?: string | null
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          owner_id?: string
          revoked_at?: string | null
          source_event_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "shield_share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shield_share_links_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shield_share_links_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "shield_events"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_handovers: {
        Row: {
          active_mission_ids: string[]
          created_at: string
          dispatcher_id: string
          id: string
          note: string | null
          pending_high_risk_mission_ids: string[]
          unresolved_sos_ids: string[]
        }
        Insert: {
          active_mission_ids?: string[]
          created_at?: string
          dispatcher_id: string
          id?: string
          note?: string | null
          pending_high_risk_mission_ids?: string[]
          unresolved_sos_ids?: string[]
        }
        Update: {
          active_mission_ids?: string[]
          created_at?: string
          dispatcher_id?: string
          id?: string
          note?: string | null
          pending_high_risk_mission_ids?: string[]
          unresolved_sos_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "shift_handovers_dispatcher_id_fkey"
            columns: ["dispatcher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          event_type: string
          id: string
          received_at: string
        }
        Insert: {
          event_type: string
          id: string
          received_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          received_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          plan: string
          renews_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan: string
          renews_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan?: string
          renews_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          id: string
          make: string
          model: string
          plate: string
          updated_at: string
          year: number | null
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          make: string
          model: string
          plate: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          make?: string
          model?: string
          plate?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      walk_with_me_sessions: {
        Row: {
          checked_in_at: string | null
          created_at: string
          destination_lat: number | null
          destination_lng: number | null
          destination_text: string
          estimated_minutes: number
          expires_at: string
          grace_minutes: number
          id: string
          notified_at: string | null
          shield_event_id: string | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          destination_lat?: number | null
          destination_lng?: number | null
          destination_text: string
          estimated_minutes: number
          expires_at: string
          grace_minutes: number
          id?: string
          notified_at?: string | null
          shield_event_id?: string | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          destination_lat?: number | null
          destination_lng?: number | null
          destination_text?: string
          estimated_minutes?: number
          expires_at?: string
          grace_minutes?: number
          id?: string
          notified_at?: string | null
          shield_event_id?: string | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "walk_with_me_sessions_shield_event_id_fkey"
            columns: ["shield_event_id"]
            isOneToOne: false
            referencedRelation: "shield_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_with_me_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_mission_briefs: {
        Row: {
          agent_count: number | null
          agent_id: string | null
          city: string | null
          client_full_name: string | null
          context_details: string | null
          context_kind:
            | Database["public"]["Enums"]["mission_context_kind"]
            | null
          destination_address: string | null
          distance_km: number | null
          dress_code: Database["public"]["Enums"]["mission_dress_code"] | null
          duration_hours: number | null
          mission_id: string | null
          mission_status: Database["public"]["Enums"]["mission_status"] | null
          mobility: Database["public"]["Enums"]["mission_mobility"] | null
          offer_expires_at: string | null
          offer_id: string | null
          offer_status:
            | Database["public"]["Enums"]["mission_offer_status"]
            | null
          offered_at: string | null
          pickup_address: string | null
          responded_at: string | null
          scheduled_at: string | null
          service_key: string | null
          verification_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_offers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_offers_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_weekly_earnings: {
        Row: {
          agent_id: string | null
          currency: string | null
          missions_completed: number | null
          total_amount: number | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_earnings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_latest_location: {
        Row: {
          agent_id: string | null
          lat: number | null
          lng: number | null
          mission_id: string | null
          recorded_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_tracking_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_tracking_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_mission_offer: { Args: { p_offer_id: string }; Returns: undefined }
      acknowledge_sos: { Args: { p_event_id: string }; Returns: undefined }
      agent_cancel_mission: {
        Args: { p_mission_id: string }
        Returns: undefined
      }
      agent_has_no_expired_documents: {
        Args: { p_agent_id: string }
        Returns: boolean
      }
      cancel_mission_by_client: {
        Args: { p_mission_id: string }
        Returns: number
      }
      cancel_sos: { Args: { p_event_id: string }; Returns: undefined }
      cancel_walk_with_me: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      check_in_walk_with_me: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      complete_mission: {
        Args: { p_mission_id: string; p_summary?: string }
        Returns: Json
      }
      compute_overage_quote: {
        Args: {
          p_additional_hours: number
          p_agent_count: number
          p_city: string
          p_night?: boolean
          p_service_key: string
          p_urgent?: boolean
          p_weekend?: boolean
        }
        Returns: Json
      }
      compute_quote: {
        Args: {
          p_accompany_minutes?: number
          p_agent_count: number
          p_city: string
          p_hours: number
          p_km: number
          p_mobility: string
          p_night?: boolean
          p_service_key: string
          p_urgent?: boolean
          p_wait_minutes?: number
          p_weekend?: boolean
        }
        Returns: Json
      }
      confirm_mission_after_payment: {
        Args: { p_mission_id: string }
        Returns: undefined
      }
      create_mission_offer: {
        Args: { p_agent_id: string; p_mission_id: string }
        Returns: string
      }
      create_payout_batch: { Args: { p_week_start: string }; Returns: string }
      create_quote_for_mission: {
        Args: { p_mission_id: string }
        Returns: string
      }
      create_shield_share_link: { Args: never; Returns: string }
      create_shift_handover: { Args: { p_note?: string }; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      decline_mission_offer: {
        Args: { p_offer_id: string }
        Returns: undefined
      }
      ensure_shield_share_link: {
        Args: { p_owner_id: string; p_source_event_id?: string }
        Returns: string
      }
      expire_mission_offer: { Args: { p_offer_id: string }; Returns: undefined }
      expire_stale_mission_offers: { Args: never; Returns: undefined }
      expire_stale_walk_with_me_sessions: { Args: never; Returns: undefined }
      extend_walk_with_me: {
        Args: { p_extra_minutes?: number; p_session_id: string }
        Returns: undefined
      }
      get_shared_mission_status: { Args: { p_token: string }; Returns: Json }
      get_shared_shield_status: { Args: { p_token: string }; Returns: Json }
      is_shield_public_enabled: { Args: never; Returns: boolean }
      is_vehicle_photo_checklist_complete: {
        Args: { p_photos: Json }
        Returns: boolean
      }
      is_weekend_pricing_window: { Args: { p_when: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action: string
          p_actor_id: string
          p_actor_role: string
          p_entity: string
          p_entity_id: string
          p_payload?: Json
        }
        Returns: undefined
      }
      log_fake_call: { Args: never; Returns: string }
      mark_payout_batch_paid: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      notify_event: {
        Args: {
          p_event: Database["public"]["Enums"]["notification_event"]
          p_mission_id?: string
          p_payload?: Json
          p_user_id: string
        }
        Returns: undefined
      }
      record_mission_location: {
        Args: { p_lat: number; p_lng: number; p_mission_id: string }
        Returns: undefined
      }
      record_payment_event: {
        Args: {
          p_amount: number
          p_mission_id: string
          p_status: Database["public"]["Enums"]["payment_status"]
          p_stripe_payment_intent_id: string
          p_type: Database["public"]["Enums"]["payment_type"]
        }
        Returns: string
      }
      record_shield_location: {
        Args: { p_lat: number; p_lng: number }
        Returns: undefined
      }
      record_webhook_event: {
        Args: { p_event_id: string; p_event_type: string }
        Returns: boolean
      }
      request_mission_overage: {
        Args: { p_additional_hours: number; p_mission_id: string }
        Returns: Json
      }
      request_more_info: {
        Args: { p_mission_id: string; p_note: string }
        Returns: undefined
      }
      resolve_sos: {
        Args: { p_event_id: string; p_journal: string }
        Returns: undefined
      }
      review_identity_verification: {
        Args: {
          p_decision: Database["public"]["Enums"]["identity_verification_status"]
          p_note?: string
          p_verification_id: string
        }
        Returns: undefined
      }
      set_user_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      start_mission_protection: {
        Args: { p_entered_code: string; p_mission_id: string }
        Returns: undefined
      }
      start_walk_with_me: {
        Args: {
          p_destination_lat?: number
          p_destination_lng?: number
          p_destination_text: string
          p_estimated_minutes: number
        }
        Returns: string
      }
      trigger_shield_sos: {
        Args: { p_lat?: number; p_lng?: number }
        Returns: string
      }
      trigger_sos: {
        Args: { p_lat?: number; p_lng?: number; p_mission_id: string }
        Returns: string
      }
      update_sos_protocol_step: {
        Args: { p_event_id: string; p_step: string; p_value: boolean }
        Returns: undefined
      }
    }
    Enums: {
      agent_document_status: "valid" | "expiring" | "expired"
      agent_document_type:
        | "atestat_igpr"
        | "cazier"
        | "ci"
        | "permis"
        | "asigurare"
      agent_source: "elite" | "verified"
      agent_status: "in_review" | "approved" | "active" | "blocked"
      identity_verification_status: "pending" | "approved" | "rejected"
      mission_agent_preference: "any" | "female" | "male"
      mission_context_kind: "usual" | "stranger" | "atm" | "club"
      mission_dress_code: "formal" | "casual" | "discreet"
      mission_mobility: "protego_vehicle" | "client_vehicle" | "on_foot"
      mission_offer_status: "pending" | "accepted" | "declined" | "expired"
      mission_status:
        | "draft"
        | "quoted"
        | "review"
        | "confirmed"
        | "assigned"
        | "enroute"
        | "arrived"
        | "active"
        | "done"
        | "cancelled_client"
        | "cancelled_agent"
        | "cancelled_dispatcher"
        | "no_agent_available"
      notification_channel: "push" | "sms"
      notification_event:
        | "offer_received"
        | "mission_confirmed"
        | "agent_arrived"
        | "mission_completed"
        | "sos_acknowledged"
        | "wwm_check_in_overdue"
      payment_status:
        | "requires_capture"
        | "succeeded"
        | "canceled"
        | "failed"
        | "processing"
      payment_type: "auth" | "capture" | "refund" | "overage_auth"
      payout_batch_status: "draft" | "paid"
      protected_person_relation:
        | "self"
        | "child"
        | "parent"
        | "partner"
        | "other"
      shield_event_source: "mission" | "shield"
      shield_event_status:
        | "open"
        | "acknowledged"
        | "resolved"
        | "cancelled_false_alarm"
      shield_event_type: "sos" | "wwm_expired" | "circle_share" | "fake_call"
      user_role: "client" | "agent" | "dispatcher" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agent_document_status: ["valid", "expiring", "expired"],
      agent_document_type: [
        "atestat_igpr",
        "cazier",
        "ci",
        "permis",
        "asigurare",
      ],
      agent_source: ["elite", "verified"],
      agent_status: ["in_review", "approved", "active", "blocked"],
      identity_verification_status: ["pending", "approved", "rejected"],
      mission_agent_preference: ["any", "female", "male"],
      mission_context_kind: ["usual", "stranger", "atm", "club"],
      mission_dress_code: ["formal", "casual", "discreet"],
      mission_mobility: ["protego_vehicle", "client_vehicle", "on_foot"],
      mission_offer_status: ["pending", "accepted", "declined", "expired"],
      mission_status: [
        "draft",
        "quoted",
        "review",
        "confirmed",
        "assigned",
        "enroute",
        "arrived",
        "active",
        "done",
        "cancelled_client",
        "cancelled_agent",
        "cancelled_dispatcher",
        "no_agent_available",
      ],
      notification_channel: ["push", "sms"],
      notification_event: [
        "offer_received",
        "mission_confirmed",
        "agent_arrived",
        "mission_completed",
        "sos_acknowledged",
        "wwm_check_in_overdue",
      ],
      payment_status: [
        "requires_capture",
        "succeeded",
        "canceled",
        "failed",
        "processing",
      ],
      payment_type: ["auth", "capture", "refund", "overage_auth"],
      payout_batch_status: ["draft", "paid"],
      protected_person_relation: [
        "self",
        "child",
        "parent",
        "partner",
        "other",
      ],
      shield_event_source: ["mission", "shield"],
      shield_event_status: [
        "open",
        "acknowledged",
        "resolved",
        "cancelled_false_alarm",
      ],
      shield_event_type: ["sos", "wwm_expired", "circle_share", "fake_call"],
      user_role: ["client", "agent", "dispatcher", "admin"],
    },
  },
} as const
