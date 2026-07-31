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
      agents: {
        Row: {
          badges: Json
          created_at: string
          id: string
          rating: number | null
          source: Database["public"]["Enums"]["agent_source"]
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
        }
        Insert: {
          badges?: Json
          created_at?: string
          id: string
          rating?: number | null
          source?: Database["public"]["Enums"]["agent_source"]
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Update: {
          badges?: Json
          created_at?: string
          id?: string
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
          agent_count: number
          agent_preference: Database["public"]["Enums"]["mission_agent_preference"]
          city: string
          client_id: string
          context_details: string | null
          context_kind: Database["public"]["Enums"]["mission_context_kind"]
          context_threat_known: boolean
          created_at: string
          destination_address: string | null
          distance_km: number | null
          dress_code: Database["public"]["Enums"]["mission_dress_code"]
          duration_hours: number | null
          id: string
          mobility: Database["public"]["Enums"]["mission_mobility"]
          payment_stub_confirmed: boolean
          pickup_address: string | null
          protected_person_id: string | null
          risk_level: string
          scheduled_at: string | null
          service_id: string
          status: Database["public"]["Enums"]["mission_status"]
          updated_at: string
          verification_code: string | null
        }
        Insert: {
          agent_count?: number
          agent_preference?: Database["public"]["Enums"]["mission_agent_preference"]
          city: string
          client_id: string
          context_details?: string | null
          context_kind?: Database["public"]["Enums"]["mission_context_kind"]
          context_threat_known?: boolean
          created_at?: string
          destination_address?: string | null
          distance_km?: number | null
          dress_code?: Database["public"]["Enums"]["mission_dress_code"]
          duration_hours?: number | null
          id?: string
          mobility?: Database["public"]["Enums"]["mission_mobility"]
          payment_stub_confirmed?: boolean
          pickup_address?: string | null
          protected_person_id?: string | null
          risk_level?: string
          scheduled_at?: string | null
          service_id: string
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string
          verification_code?: string | null
        }
        Update: {
          agent_count?: number
          agent_preference?: Database["public"]["Enums"]["mission_agent_preference"]
          city?: string
          client_id?: string
          context_details?: string | null
          context_kind?: Database["public"]["Enums"]["mission_context_kind"]
          context_threat_known?: boolean
          created_at?: string
          destination_address?: string | null
          distance_km?: number | null
          dress_code?: Database["public"]["Enums"]["mission_dress_code"]
          duration_hours?: number | null
          id?: string
          mobility?: Database["public"]["Enums"]["mission_mobility"]
          payment_stub_confirmed?: boolean
          pickup_address?: string | null
          protected_person_id?: string | null
          risk_level?: string
          scheduled_at?: string | null
          service_id?: string
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string
          verification_code?: string | null
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
      pricing_config: {
        Row: {
          base: number
          city: string
          coef_night: number
          coef_urgent: number
          coef_weekend: number
          created_at: string
          degressive_rate: number
          degressive_threshold_hours: number | null
          free_cancel_minutes: number
          id: string
          min_billing_hours: number
          per_hour_agent: number
          per_hour_vehicle: number
          per_km: number
          platform_fee: number
          service_id: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          base?: number
          city: string
          coef_night?: number
          coef_urgent?: number
          coef_weekend?: number
          created_at?: string
          degressive_rate?: number
          degressive_threshold_hours?: number | null
          free_cancel_minutes?: number
          id?: string
          min_billing_hours?: number
          per_hour_agent?: number
          per_hour_vehicle?: number
          per_km?: number
          platform_fee?: number
          service_id: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          base?: number
          city?: string
          coef_night?: number
          coef_urgent?: number
          coef_weekend?: number
          created_at?: string
          degressive_rate?: number
          degressive_threshold_hours?: number | null
          free_cancel_minutes?: number
          id?: string
          min_billing_hours?: number
          per_hour_agent?: number
          per_hour_vehicle?: number
          per_km?: number
          platform_fee?: number
          service_id?: string
          updated_at?: string
          vat_rate?: number
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
          updated_at: string
          verification_level: number
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          verification_level?: number
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
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
      quotes: {
        Row: {
          breakdown: Json
          created_at: string
          currency: string
          id: string
          mission_id: string
          total_estimate: number
        }
        Insert: {
          breakdown: Json
          created_at?: string
          currency?: string
          id?: string
          mission_id: string
          total_estimate: number
        }
        Update: {
          breakdown?: Json
          created_at?: string
          currency?: string
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_quote: {
        Args: {
          p_agent_count: number
          p_city: string
          p_hours: number
          p_km: number
          p_mobility: string
          p_night?: boolean
          p_service_key: string
          p_urgent?: boolean
          p_weekend?: boolean
        }
        Returns: Json
      }
      create_quote_for_mission: {
        Args: { p_mission_id: string }
        Returns: string
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
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
      protected_person_relation:
        | "self"
        | "child"
        | "parent"
        | "partner"
        | "other"
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
      protected_person_relation: [
        "self",
        "child",
        "parent",
        "partner",
        "other",
      ],
      user_role: ["client", "agent", "dispatcher", "admin"],
    },
  },
} as const
