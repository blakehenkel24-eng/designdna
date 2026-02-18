export type ExtractionStatus = "queued" | "running" | "completed" | "failed";

export type ExtractionErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_URL"
  | "TARGET_BLOCKED"
  | "AUTH_REQUIRED_UNSUPPORTED"
  | "TIMEOUT"
  | "NAVIGATION_FAILED"
  | "CAPTURE_FAILED"
  | "QUOTA_EXCEEDED"
  | "INTERNAL_ERROR";

export type DesignTokenFrequency = {
  value: string;
  count: number;
};

export type ShadowToken = {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color: string;
  alpha?: number;
  inset?: boolean;
};

export type ComponentRecipe = {
  selector: string;
  type: string;
  text_preview?: string;
  background_color?: string;
  text_color?: string;
  border_color?: string;
  border_width_px?: number;
  border_style?: string;
  radius_px?: number;
  padding_x_px?: number;
  padding_y_px?: number;
  font_family?: string;
  font_size_px?: number;
  font_weight?: number;
  shadow?: ShadowToken;
  notes?: string[];
};

export type StyleSpec = {
  url: string;
  viewport: { width: number; height: number };
  palette: {
    colors: Array<{ hex: string; usageHint: string; weight: number }>;
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
    primaryFamily?: string;
    secondaryFamily?: string;
    scale: Array<{ px: number; roleHint: string; weight: number }>;
    weights: number[];
    lineHeights: Array<{ value: number; unit: "px" | "number" }>;
    letterSpacing?: Array<{ px: number; weight: number }>;
  };
  tokens: {
    spacingPx: Array<{ value: number; weight: number }>;
    radiusPx: Array<{ value: number; weight: number }>;
    shadows: Array<{ value: string; weight: number }>;
    effects: Array<{ value: string; weight: number }>;
  };
  layout: {
    containerWidth?: number;
    sectionVerticalSpacing?: number[];
    gridPatterns?: string[];
  };
  components: {
    primaryButton?: ComponentRecipe;
    secondaryButton?: ComponentRecipe;
    card?: ComponentRecipe;
    input?: ComponentRecipe;
    link?: ComponentRecipe;
  };
  sections: Array<{
    label: string;
    selector: string;
    bounds: { x: number; y: number; width: number; height: number };
  }>;
  cssVars?: Record<string, string>;
  vision?: { dominantColors: string[]; notes: string[] };
};

export type DesignDnaPack = {
  meta: {
    url: string;
    captured_at: string;
    capture_version: string;
    viewport: { width: number; height: number };
    compliance_flags: {
      robots_allowed: boolean;
      blocked: boolean;
      blocked_reason?: string;
    };
  };
  design_tokens: {
    colors: DesignTokenFrequency[];
    typography: {
      families: DesignTokenFrequency[];
      sizes: DesignTokenFrequency[];
      weights: DesignTokenFrequency[];
      line_heights: DesignTokenFrequency[];
    };
    spacing: DesignTokenFrequency[];
    radii: DesignTokenFrequency[];
    shadows: DesignTokenFrequency[];
    borders: DesignTokenFrequency[];
    effects: DesignTokenFrequency[];
  };
  layout_map: {
    sections: Array<{
      id: string;
      selector: string;
      role: string;
      bounds: { x: number; y: number; width: number; height: number };
      children: string[];
      responsive_hints: string[];
    }>;
  };
  components: Array<{
    id: string;
    selector: string;
    type: string;
    text_preview: string;
    style_signature: string;
  }>;
  assets: {
    images: Array<{ url: string; selector: string }>;
    fonts: Array<{ family: string; source: string }>;
    icons: Array<{ url: string; rel: string }>;
  };
  content_summary: {
    title: string;
    headings: string[];
    buttons: string[];
    nav_items: string[];
  };
  recreation_guidance: {
    objective: string;
    constraints: string[];
    warnings: string[];
  };
  confidence: {
    overall: number;
    sections: Array<{ section_id: string; score: number }>;
  };
  vision_summary: {
    dominant_colors: string[];
    notes: string[];
  };
  style_spec?: StyleSpec;
};

export type ExtractionJobPayload = {
  extractionId: string;
  userId: string;
  url: string;
};

export type ExtractionRow = {
  id: string;
  user_id: string;
  url: string;
  status: ExtractionStatus;
  progress_pct: number;
  error_code: ExtractionErrorCode | null;
  error_message: string | null;
  blocked_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type ExtractionArtifactRow = {
  id: string;
  extraction_id: string;
  prompt_text: string;
  pack_json: DesignDnaPack;
  screenshot_path: string | null;
  trace_path: string | null;
  created_at: string;
};
