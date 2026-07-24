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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
