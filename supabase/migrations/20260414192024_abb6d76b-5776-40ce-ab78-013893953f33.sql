
-- Create public storage bucket for character overlay assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('character-overlays', 'character-overlays', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to overlay assets
CREATE POLICY "Anyone can view character overlays"
ON storage.objects FOR SELECT
USING (bucket_id = 'character-overlays');

-- Allow admins to manage overlay assets
CREATE POLICY "Admins manage character overlays"
ON storage.objects FOR ALL
USING (
  bucket_id = 'character-overlays'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);
