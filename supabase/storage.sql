INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', false);

CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('uploads', 'exports'));
CREATE POLICY "Allow authenticated downloads" ON storage.objects FOR SELECT USING (bucket_id IN ('uploads', 'exports'));
CREATE POLICY "Allow authenticated deletes" ON storage.objects FOR DELETE USING (bucket_id IN ('uploads', 'exports'));
