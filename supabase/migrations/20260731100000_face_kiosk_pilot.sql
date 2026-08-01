-- ============================================================
-- 얼굴 키오스크 파일럿 (2026-07-31 운영 적용 완료)
-- 선릉 기존 안드로이드 키오스크 브라우저에서 /face-kiosk/:branchCode 실행.
-- 원칙: 얼굴 사진 저장 금지(128차원 특징값만), 동의(consent_at) 필수,
--       클라이언트 직접 접근 차단(face-kiosk Edge Function + 키오스크 키 경유).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.face_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding   double precision[] NOT NULL,
  consent_at  timestamptz NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.face_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.face_profiles FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_face_profiles_user ON public.face_profiles (user_id) WHERE active;

INSERT INTO public.internal_sync_config (key, value)
VALUES ('face_kiosk_key', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (key) DO NOTHING;
