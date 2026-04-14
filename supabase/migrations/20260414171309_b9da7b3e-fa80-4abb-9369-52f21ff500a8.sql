
-- Preset-aware customization variant mapping table
-- Each row links a specific customization option to a specific preset
-- with per-preset anchor/scale/asset data
CREATE TABLE public.preset_customization_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_style TEXT NOT NULL,
  category_code TEXT NOT NULL,
  option_key TEXT NOT NULL,
  asset_url TEXT,
  anchor_x NUMERIC NOT NULL DEFAULT 50,
  anchor_y NUMERIC NOT NULL DEFAULT 50,
  scale NUMERIC NOT NULL DEFAULT 1.0,
  rotation NUMERIC NOT NULL DEFAULT 0,
  z_order INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  preview_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (preset_style, category_code, option_key)
);

ALTER TABLE public.preset_customization_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated view variants"
  ON public.preset_customization_variants
  FOR SELECT
  USING (true);

CREATE POLICY "Admins manage variants"
  ON public.preset_customization_variants
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_pcv_preset_cat ON public.preset_customization_variants (preset_style, category_code);
