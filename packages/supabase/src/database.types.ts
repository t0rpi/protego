// Hand-written to match supabase/migrations/*.sql exactly, in the shape
// `supabase gen types typescript` produces. Once the project is linked
// (`supabase link`) and reachable, regenerate for real via:
//   pnpm --filter @protego/supabase run types:generate
// M1 tables only (protected_persons, agents, agent_documents,
// identity_verifications, audit_log, profiles) — everything else
// (missions, quotes, payments, ...) lands with its own milestone.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          verification_level: number;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: Database["public"]["Enums"]["user_role"];
          verification_level?: number;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["user_role"];
          verification_level?: number;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      protected_persons: {
        Row: {
          id: string;
          owner_id: string;
          full_name: string;
          relation: Database["public"]["Enums"]["protected_person_relation"];
          date_of_birth: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          full_name: string;
          relation?: Database["public"]["Enums"]["protected_person_relation"];
          date_of_birth?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          full_name?: string;
          relation?: Database["public"]["Enums"]["protected_person_relation"];
          date_of_birth?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "protected_persons_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      agents: {
        Row: {
          id: string;
          source: Database["public"]["Enums"]["agent_source"];
          status: Database["public"]["Enums"]["agent_status"];
          rating: number | null;
          badges: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          source?: Database["public"]["Enums"]["agent_source"];
          status?: Database["public"]["Enums"]["agent_status"];
          rating?: number | null;
          badges?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source?: Database["public"]["Enums"]["agent_source"];
          status?: Database["public"]["Enums"]["agent_status"];
          rating?: number | null;
          badges?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agents_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_documents: {
        Row: {
          id: string;
          agent_id: string;
          type: Database["public"]["Enums"]["agent_document_type"];
          file_path: string;
          expires_at: string | null;
          status: Database["public"]["Enums"]["agent_document_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          type: Database["public"]["Enums"]["agent_document_type"];
          file_path: string;
          expires_at?: string | null;
          status?: Database["public"]["Enums"]["agent_document_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          type?: Database["public"]["Enums"]["agent_document_type"];
          file_path?: string;
          expires_at?: string | null;
          status?: Database["public"]["Enums"]["agent_document_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_documents_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
        ];
      };
      identity_verifications: {
        Row: {
          id: string;
          user_id: string;
          id_card_path: string;
          selfie_path: string;
          status: Database["public"]["Enums"]["identity_verification_status"];
          reviewed_by: string | null;
          reviewed_at: string | null;
          reviewer_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          id_card_path: string;
          selfie_path: string;
          status?: Database["public"]["Enums"]["identity_verification_status"];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          reviewer_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          id_card_path?: string;
          selfie_path?: string;
          status?: Database["public"]["Enums"]["identity_verification_status"];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          reviewer_note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "identity_verifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_role: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_role?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          actor_role?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          payload?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      log_audit_event: {
        Args: {
          p_actor_id: string | null;
          p_actor_role: string | null;
          p_action: string;
          p_entity: string;
          p_entity_id: string | null;
          p_payload?: Json | null;
        };
        Returns: undefined;
      };
      set_user_role: {
        Args: {
          p_user_id: string;
          p_new_role: Database["public"]["Enums"]["user_role"];
        };
        Returns: undefined;
      };
      review_identity_verification: {
        Args: {
          p_verification_id: string;
          p_decision: Database["public"]["Enums"]["identity_verification_status"];
          p_note?: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: "client" | "agent" | "dispatcher" | "admin";
      protected_person_relation: "self" | "child" | "parent" | "partner" | "other";
      agent_source: "elite" | "verified";
      agent_status: "in_review" | "approved" | "active" | "blocked";
      agent_document_type: "atestat_igpr" | "cazier" | "ci" | "permis" | "asigurare";
      agent_document_status: "valid" | "expiring" | "expired";
      identity_verification_status: "pending" | "approved" | "rejected";
    };
    CompositeTypes: Record<string, never>;
  };
}
