
CREATE POLICY "photos upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos read referenced" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text AND (
    (storage.foldername(name))[2] = 'avatar'
    OR EXISTS (SELECT 1 FROM public.transaction_photos p JOIN public.transactions t ON t.id = p.transaction_id
      WHERE (p.original_path = storage.objects.name OR p.thumb_path = storage.objects.name)
        AND t.owner_id = auth.uid() AND (t.deleted_at IS NULL OR t.deleted_at > now() - interval '30 days'))
  ));
