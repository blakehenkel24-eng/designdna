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
