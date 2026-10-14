-- 📸 프로필 사진 첫 등록 보상 — '진짜 사진' 확인 강화 (2026-10-14, 검수 보완)
--
--   avatars 버킷은 파일 종류·크기 제한이 없어서, 내 폴더(avatars/{내 id}/)에 아무 파일(1바이트)이나 올리고
--   avatar_url 만 맞추면 보상 조건이 맞았다. 이제 이미지 파일(mimetype image/*)이고 1KB 이상이어야 한다.
--   앱은 사진을 512px JPEG 로 줄여 올린다 (보통 10KB 이상).
--   운영 실측(적용 전): 기존 사진 7장 모두 image/jpeg · 8KB 이상 → 그대로 보상 대상.
-- 바뀌는 것은 avatar_photo_uploaded() 하나뿐 — 금액·한 번만·지도진 제외 규칙은 20261014170000 그대로.
-- 금액을 바꾸면 avatar_photo_reward() 와 함께 오삼이 FAQ 문구(src/data/osamiFaq.ts — acct-photo · rw-gems 의 +5,000)도 고친다.

create or replace function public.avatar_photo_uploaded(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from profiles p
            where p.user_id = _uid
              and position('/storage/v1/object/public/avatars/' || _uid::text || '/' in coalesce(p.avatar_url, '')) > 0
         )
     and exists (
           select 1 from storage.objects o
            where o.bucket_id = 'avatars'
              and o.name like _uid::text || '/%'
              and coalesce(o.metadata->>'mimetype', '') like 'image/%'
              and (case when coalesce(o.metadata->>'size', '') ~ '^[0-9]+$'
                        then (o.metadata->>'size')::bigint else 0 end) >= 1024
         )
$$;

revoke all on function public.avatar_photo_uploaded(uuid) from public, anon, authenticated;
