import { z } from "zod";

const hexColorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

const shadowTokenSchema = z.object({
  x: z.number(),
  y: z.number(),
  blur: z.number(),
  spread: z.number().optional(),
  color: hexColorSchema,
  alpha: z.number().min(0).max(1).optional(),
  inset: z.boolean().optional(),
});

const componentRecipeSchema = z.object({
  selector: z.string(),
  type: z.string(),
  text_preview: z.string().optional(),
  background_color: hexColorSchema.optional(),
  text_color: hexColorSchema.optional(),
  border_color: hexColorSchema.optional(),
  border_width_px: z.number().optional(),
  border_style: z.string().optional(),
  radius_px: z.number().optional(),
  padding_x_px: z.number().optional(),
  padding_y_px: z.number().optional(),
  font_family: z.string().optional(),
  font_size_px: z.number().optional(),
  font_weight: z.number().optional(),
  shadow: shadowTokenSchema.optional(),
  notes: z.array(z.string()).optional(),
});

export const styleSpecSchema = z.object({
  url: z.string().url(),
  viewport: z.object({ width: z.number().positive(), height: z.number().positive() }),
  palette: z.object({
    colors: z.array(
      z.object({
        hex: hexColorSchema,
        usageHint: z.string(),
        weight: z.number().nonnegative(),
      }),
    ),
    roles: z.object({
      primary: hexColorSchema.optional(),
      secondary: hexColorSchema.optional(),
      background: hexColorSchema.optional(),
      surface: hexColorSchema.optional(),
      textPrimary: hexColorSchema.optional(),
      textSecondary: hexColorSchema.optional(),
      border: hexColorSchema.optional(),
      accent: hexColorSchema.optional(),
    }),
  }),
  typography: z.object({
    primaryFamily: z.string().optional(),
    secondaryFamily: z.string().optional(),
    scale: z.array(
      z.object({
        px: z.number().positive(),
        roleHint: z.string(),
        weight: z.number().nonnegative(),
      }),
    ),
    weights: z.array(z.number()),
    lineHeights: z.array(
      z.object({
        value: z.number().positive(),
        unit: z.enum(["px", "number"]),
      }),
    ),
    letterSpacing: z
      .array(
        z.object({
          px: z.number(),
          weight: z.number().nonnegative(),
        }),
      )
      .optional(),
  }),
  tokens: z.object({
    spacingPx: z.array(z.object({ value: z.number(), weight: z.number().nonnegative() })),
    radiusPx: z.array(z.object({ value: z.number(), weight: z.number().nonnegative() })),
    shadows: z.array(z.object({ value: z.string(), weight: z.number().nonnegative() })),
    effects: z.array(z.object({ value: z.string(), weight: z.number().nonnegative() })),
  }),
  layout: z.object({
    containerWidth: z.number().positive().optional(),
    sectionVerticalSpacing: z.array(z.number().positive()).optional(),
    gridPatterns: z.array(z.string()).optional(),
  }),
  components: z.object({
    primaryButton: componentRecipeSchema.optional(),
    secondaryButton: componentRecipeSchema.optional(),
    card: componentRecipeSchema.optional(),
    input: componentRecipeSchema.optional(),
    link: componentRecipeSchema.optional(),
  }),
  sections: z.array(
    z.object({
      label: z.string(),
      selector: z.string(),
      bounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number().nonnegative(),
        height: z.number().nonnegative(),
      }),
    }),
  ),
  cssVars: z.record(z.string(), z.string()).optional(),
  vision: z
    .object({
      dominantColors: z.array(hexColorSchema),
      notes: z.array(z.string()),
    })
    .optional(),
});

export const semanticTokensJsonSchema = z.object({
  schema_version: z.literal("1.0"),
  generated_at: z.string(),
  source_url: z.string().url(),
  design_prompt: z.string(),
  tokens: z.object({
    color: z.object({
      palette: z.array(hexColorSchema).min(1),
      roles: z.object({
        primary: hexColorSchema.optional(),
        secondary: hexColorSchema.optional(),
        background: hexColorSchema.optional(),
        surface: hexColorSchema.optional(),
        textPrimary: hexColorSchema.optional(),
        textSecondary: hexColorSchema.optional(),
        border: hexColorSchema.optional(),
        accent: hexColorSchema.optional(),
      }),
    }),
    typography: z.object({
      families: z.array(z.string()),
      scale: z.array(z.number()),
      weights: z.array(z.number()),
      line_heights: z.array(z.number()),
    }),
    spacing: z.array(z.number()),
    radius: z.array(z.number()),
    shadow: z.array(z.string()),
    effects: z.array(z.string()),
  }),
  components: z.object({
    primary_button: componentRecipeSchema.optional(),
    secondary_button: componentRecipeSchema.optional(),
    card: componentRecipeSchema.optional(),
    input: componentRecipeSchema.optional(),
    link: componentRecipeSchema.optional(),
  }),
  sections: z.array(
    z.object({
      label: z.string(),
      selector: z.string(),
      width: z.number(),
      height: z.number(),
    }),
  ),
  notes: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export const llmEnhancementSchema = z.object({
  prompt: z.string().min(1),
  summary: z.string().min(1),
  designBlueprint: z.object({
    themeReference: z.string().min(1),
    colors: z.array(hexColorSchema),
    typography: z.array(z.string()),
    effects: z.array(z.string()),
    htmlStructure: z.array(z.string()),
  }),
  tokensJson: semanticTokensJsonSchema,
  starterHtmlCss: z.string(),
});

export type SemanticTokensJson = z.infer<typeof semanticTokensJsonSchema>;
export type LlmEnhancementPayload = z.infer<typeof llmEnhancementSchema>;
