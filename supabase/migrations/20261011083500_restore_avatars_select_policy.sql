-- 프로필 사진 업로드 복구 (2026-10-11)
-- 원인: avatars 버킷의 SELECT 정책("Avatar images are publicly accessible")이 사라져
--       storage upsert 업로드(RETURNING *)가 RLS 42501 로 거부됨.
--       (업로드 upsert 는 select + insert + update 세 정책이 모두 필요)
-- 조치: 2026-04-08 마이그레이션(20260408125232)에 있던 원래 정책을 그대로 복원.
-- 적용: mcp apply_migration 으로 2026-10-11 운영 반영 완료. 이 파일은 기록용.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname = 'Avatar images are publicly accessible'
  ) THEN
    CREATE POLICY "Avatar images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');
  END IF;
END $$;
