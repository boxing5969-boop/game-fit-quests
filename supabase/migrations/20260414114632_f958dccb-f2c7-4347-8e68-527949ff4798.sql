
-- Character part categories
CREATE TABLE public.character_part_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  layer_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.character_part_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated view part categories" ON public.character_part_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage part categories" ON public.character_part_categories
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Character parts (individual assets)
CREATE TABLE public.character_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code text NOT NULL REFERENCES public.character_part_categories(code),
  asset_key text NOT NULL,
  label text NOT NULL,
  gender_group text NOT NULL DEFAULT 'neutral',
  style_group text NOT NULL DEFAULT 'default',
  image_url text,
  is_placeholder boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category_code, asset_key)
);
ALTER TABLE public.character_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated view parts" ON public.character_parts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon view parts" ON public.character_parts
  FOR SELECT TO anon USING (true);
CREATE POLICY "Admins manage parts" ON public.character_parts
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Character presets (assembled characters)
CREATE TABLE public.character_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  parts_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  flattened_image_url text,
  created_by uuid,
  is_template boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.character_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated view presets" ON public.character_presets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon view presets" ON public.character_presets
  FOR SELECT TO anon USING (true);
CREATE POLICY "Admins manage presets" ON public.character_presets
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Branch managers manage presets" ON public.character_presets
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'branch_manager'::app_role));
CREATE POLICY "Users create own presets" ON public.character_presets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users update own presets" ON public.character_presets
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- Member character assignments
CREATE TABLE public.member_character_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  preset_id uuid NOT NULL REFERENCES public.character_presets(id) ON DELETE CASCADE,
  display_mode text NOT NULL DEFAULT 'sprite',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_character_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated view assignments" ON public.member_character_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon view assignments" ON public.member_character_assignments
  FOR SELECT TO anon USING (true);
CREATE POLICY "Users manage own assignment" ON public.member_character_assignments
  FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Branch managers manage assignments" ON public.member_character_assignments
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'branch_manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Trigger for updated_at on presets
CREATE TRIGGER update_character_presets_updated_at
  BEFORE UPDATE ON public.character_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_character_assignments_updated_at
  BEFORE UPDATE ON public.member_character_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed categories
INSERT INTO public.character_part_categories (code, name, layer_order, is_required) VALUES
  ('base', '바디', 0, true),
  ('skin', '피부톤', 1, true),
  ('hair_back', '뒷머리', 2, false),
  ('top', '상의', 3, true),
  ('shorts', '하의', 4, true),
  ('shoes', '신발', 5, true),
  ('hair_front', '앞머리', 6, false),
  ('eyebrows', '눈썹', 7, false),
  ('eyes', '눈', 8, true),
  ('mouth', '표정', 9, true),
  ('gloves', '글러브', 10, true),
  ('accessory', '액세서리', 11, false),
  ('effect', '이펙트', 12, false);
