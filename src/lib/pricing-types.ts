export type EntitlementPlan = "FREE" | "PRO_ACTIVE" | "PRO_CANCELED_GRACE";

export type EntitlementState = {
  user_id: string;
  plan: EntitlementPlan;
  analyses_used_this_period: number;
  analyses_limit_this_period: number;
  topup_balance: number;
  period_start: string;
  period_end: string;
  remaining_analyses: number;
  can_export_json: boolean;
  can_view_history: boolean;
};

export type AnalysisExportV1 = {
  schema_version: "1.0";
  source_url: string;
  timestamp: string;
  design_prompt: string;
  tokens: {
    color: {
      palette: string[];
      roles: {
        primary?: string;
        secondary?: string;
        background?: string;
        surface?: string;
        textPrimary?: string;
        textSecondary?: string;
        border?: string;
        accent?: string;
      };
    };
    typography: {
      families: string[];
      scale: number[];
      weights: number[];
      line_heights: number[];
    };
    spacing: number[];
    radius: number[];
    shadow: string[];
    effects: string[];
  };
  components: {
    primary_button?: Record<string, unknown>;
    secondary_button?: Record<string, unknown>;
    card?: Record<string, unknown>;
    input?: Record<string, unknown>;
    link?: Record<string, unknown>;
  };
  sections: Array<{
    label: string;
    selector: string;
    width: number;
    height: number;
  }>;
  structure: {
    sections: string[];
    hints: string[];
  };
  notes: string[];
  assumptions: string[];
};

export type PreviewPayload = {
  source_url: string;
  summary: string;
  prompt: string;
  theme_reference: string;
  typography: string[];
  colors: string[];
  effects: string[];
  html_structure: string[];
};
