export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      extractions: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          status: "queued" | "running" | "completed" | "failed";
          progress_pct: number;
          error_code: string | null;
          error_message: string | null;
          blocked_reason: string | null;
          started_at: string | null;
          completed_at: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          status: "queued" | "running" | "completed" | "failed";
          progress_pct?: number;
          error_code?: string | null;
          error_message?: string | null;
          blocked_reason?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          expires_at: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["extractions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "extractions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      extraction_artifacts: {
        Row: {
          id: string;
          extraction_id: string;
          prompt_text: string;
          pack_json: Json;
          screenshot_path: string | null;
          trace_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          extraction_id: string;
          prompt_text: string;
          pack_json: Json;
          screenshot_path?: string | null;
          trace_path?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["extraction_artifacts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "extraction_artifacts_extraction_id_fkey";
            columns: ["extraction_id"];
            referencedRelation: "extractions";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_counters: {
        Row: {
          user_id: string;
          date_utc: string;
          extractions_count: number;
        };
        Insert: {
          user_id: string;
          date_utc: string;
          extractions_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["usage_counters"]["Insert"]>;
        Relationships: [];
      };
      rate_limit_config: {
        Row: {
          plan: string;
          daily_cap: number;
        };
        Insert: {
          plan: string;
          daily_cap: number;
        };
        Update: Partial<Database["public"]["Tables"]["rate_limit_config"]["Insert"]>;
        Relationships: [];
      };
      user_entitlements: {
        Row: {
          user_id: string;
          plan: "FREE" | "PRO_ACTIVE" | "PRO_CANCELED_GRACE";
          analyses_used_this_period: number;
          analyses_limit_this_period: number;
          topup_balance: number;
          period_start: string;
          period_end: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan?: "FREE" | "PRO_ACTIVE" | "PRO_CANCELED_GRACE";
          analyses_used_this_period?: number;
          analyses_limit_this_period?: number;
          topup_balance?: number;
          period_start: string;
          period_end: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_entitlements"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "user_entitlements_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      analysis_history: {
        Row: {
          id: string;
          user_id: string;
          source_url: string;
          preview_payload: Json;
          export_payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_url: string;
          preview_payload: Json;
          export_payload: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["analysis_history"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "analysis_history_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string | null;
          event_name: string;
          event_payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_name: string;
          event_payload?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["analytics_events"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          id: string;
        };
        Insert: {
          id: string;
        };
        Update: {
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      consume_user_quota: {
        Args: {
          p_user_id: string;
          p_cap: number;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
