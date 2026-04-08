-- Create storage bucket for mission videos
INSERT INTO storage.buckets (id, name, public) VALUES ('mission-videos', 'mission-videos', true);

-- Public read access
CREATE POLICY "Anyone can view mission videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'mission-videos');

-- Admin upload
CREATE POLICY "Admins can upload mission videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'mission-videos' AND public.has_role(auth.uid(), 'admin'));

-- Admin update
CREATE POLICY "Admins can update mission videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'mission-videos' AND public.has_role(auth.uid(), 'admin'));

-- Admin delete
CREATE POLICY "Admins can delete mission videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'mission-videos' AND public.has_role(auth.uid(), 'admin'));