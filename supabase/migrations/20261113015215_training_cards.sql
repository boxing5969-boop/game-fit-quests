-- 🃏 153 콘텐츠 카드 — 훈련 라이브러리에 영상 칸 · 비공개 영상 저장소 · 카드 고치기 권한 · 새 카드 4장
-- 2026-11-13 대표님 「추천대로 진행」 — 설계 문서 「153 트레이닝 콘텐츠 구조 설계 — 전략 회의 · 훈련 탭」
--   https://claude.ai/artifact/QRkpNriftYizMqQdaqnZVj (「데이터 · 저장 · 권한」 · 결정 6번)
--
-- 새 표는 만들지 않는다. 바꾸는 것:
--   1) training_exercises 에 칸 5개 — video_path(회원용 영상 member/…) · coach_video_path(코치용 coach/…) ·
--      poster_path(첫 장면 member/…) · minutes(기본 몇 분 1~120) · equipment(준비물 60자). 예전 video_url(링크)은 그대로
--   2) 비공개 저장소 training-videos (mp4 · webp/jpg/png · 50MB)
--        member/ 읽기 = 로그인한 사람 누구나(서명 주소) · coach/ 읽기 = 코치진(_strategy_staff) · 넣기 = 대표님 · 운영진(has_role super_admin · admin)
--        ⚠️ storage.objects 정책에는 authenticated 가 실행할 수 있는 함수만 — _strategy_hq 는 안쪽 함수(실행 권한 없음)라 넣으면
--           'permission denied' 가 나고, 정책은 저장소마다 나뉘지 않아 다른 저장소(커뮤니티 사진 등) 올리기까지 모두 막힌다
--           (2026-11-13 적용 직후 되돌림 시험에서 발견 · 21분 만에 has_role 로 고침 — 그사이 올리기 시도 0건)
--        파일을 덮어쓰거나 지우는 정책은 두지 않는다 — 앱은 늘 새 파일을 올리고 카드 칸만 바꾼다(빼도 파일은 남음). 지울 일이 있으면 대시보드에서
--      코치님 얼굴이 나오는 영상이라 공개 저장소(mission-videos)가 아니라 비공개 — 동의를 거두면 바로 내릴 수 있게
--   3) 카드 쓰기 정책 tex_write 를 대표님 · 운영진(super_admin · admin)으로 좁힌다 — 모든 지점이 같은 카드를 본다 (읽기 tex_read 는 그대로)
--   4) 새 카드 4장(11/12 촬영) — 십자 스텝 · 뛰는 스텝(풋워크) · 워킹 런지(워밍업) · 샌드백 구령(샌드백). 이름이 같은 카드가 있으면 넣지 않는다
--   5) 「위빙」 카드 글을 11/12 영상 속 코치님 말로 다듬는다 — 예전 글 그대로일 때만(그사이 누가 고쳤으면 그대로 둔다)
-- 글은 src/lib/trainingCardsSample.ts(NEW_CARDS_1112 · WEAVING_POLISHED)와 같다 — 한쪽을 고치면 같이 고친다.
-- 서버 함수는 없다(화면이 표 · 저장소를 바로 쓴다 — RLS 가 막는다). 몇 번을 돌려도 결과가 같다.

-- ───────────────────────── 1) 칸 5개 ─────────────────────────
alter table public.training_exercises
  add column if not exists video_path text,
  add column if not exists coach_video_path text,
  add column if not exists poster_path text,
  add column if not exists minutes smallint,
  add column if not exists equipment text;

comment on column public.training_exercises.video_path is '회원용 영상(정사각 · 소리 없음) — 비공개 저장소 training-videos 의 member/… 경로 (2026-11-13)';
comment on column public.training_exercises.coach_video_path is '코치용 영상(가로 · 목소리) — training-videos 의 coach/… 경로, 코치진만 (2026-11-13)';
comment on column public.training_exercises.poster_path is '첫 장면 그림 — training-videos 의 member/… 경로 (없으면 image_url)';
comment on column public.training_exercises.minutes is '오늘 프로그램 블록의 기본 분 (1~120, 없으면 칸 기본값)';
comment on column public.training_exercises.equipment is '준비물 (예: 아령 0.5~1kg)';

do $$ begin
  alter table public.training_exercises add constraint training_exercises_video_path_chk
    check (video_path is null or video_path ~ '^member/[A-Za-z0-9._-]{1,120}\.mp4$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.training_exercises add constraint training_exercises_coach_video_path_chk
    check (coach_video_path is null or coach_video_path ~ '^coach/[A-Za-z0-9._-]{1,120}\.mp4$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.training_exercises add constraint training_exercises_poster_path_chk
    check (poster_path is null or poster_path ~ '^member/[A-Za-z0-9._-]{1,120}\.(webp|jpg|jpeg|png)$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.training_exercises add constraint training_exercises_minutes_chk
    check (minutes is null or minutes between 1 and 120);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.training_exercises add constraint training_exercises_equipment_chk
    check (equipment is null or char_length(equipment) <= 60);
exception when duplicate_object then null; end $$;

-- ───────────────────────── 2) 비공개 영상 저장소 ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('training-videos', 'training-videos', false, 52428800,
        array['video/mp4', 'image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

do $$ begin
  create policy "training videos member read" on storage.objects for select to authenticated
    using (bucket_id = 'training-videos' and (storage.foldername(name))[1] = 'member');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "training videos coach read" on storage.objects for select to authenticated
    using (bucket_id = 'training-videos' and (storage.foldername(name))[1] = 'coach'
           and public._strategy_staff(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "training videos hq insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'training-videos' and (storage.foldername(name))[1] in ('member', 'coach')
                and (public.has_role(auth.uid(), 'super_admin'::public.app_role) or public.has_role(auth.uid(), 'admin'::public.app_role)));
exception when duplicate_object then null; end $$;

-- ───────────────────────── 3) 카드 쓰기 = 대표님 · 운영진 ─────────────────────────
-- 지금 정책(코치 · 지점장 · 운영진 모두)의 사람만 좁힌다. 정책이 없는 DB(옛 DB 등)면 같은 이름으로 만든다.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_exercises' and policyname = 'tex_write') then
    execute $p$alter policy tex_write on public.training_exercises
      using (public.has_role(auth.uid(), 'super_admin'::public.app_role) or public.has_role(auth.uid(), 'admin'::public.app_role))
      with check (public.has_role(auth.uid(), 'super_admin'::public.app_role) or public.has_role(auth.uid(), 'admin'::public.app_role))$p$;
  else
    execute $p$create policy tex_write on public.training_exercises for all
      using (public.has_role(auth.uid(), 'super_admin'::public.app_role) or public.has_role(auth.uid(), 'admin'::public.app_role))
      with check (public.has_role(auth.uid(), 'super_admin'::public.app_role) or public.has_role(auth.uid(), 'admin'::public.app_role))$p$;
  end if;
end $$;

-- ───────────────────────── 4) 새 카드 4장 (11/12 촬영) ─────────────────────────
insert into public.training_exercises
  (id, category, name, summary, description, benefits, target, difficulty, cues, mistakes, level_min, sort_order, is_active, minutes, equipment)
select v.id, v.category, v.name, v.summary, v.description, '', v.target, v.difficulty, v.cues, v.mistakes, v.level_min, v.sort_order, true, v.minutes, null
from (values
  ('1530c4d0-0001-4a00-8000-000000001112'::uuid, '풋워크', '십자 스텝',
   '옆 · 앞 · 옆 · 앞 — 바닥에 십자를 그리며 스탠스를 지켜요',
   '스탠스를 유지한 채 옆으로 한 걸음, 앞으로 한 걸음, 다시 옆, 다시 앞으로 십자를 그리며 움직여요. 돌아올 때는 같은 길을 거꾸로 되돌려요. 하나 · 둘 · 셋 · 넷 박자에 맞춰 천천히 시작하고, 익숙해지면 조금씩 빠르게 해요.',
   '스텝 · 리듬', '초급',
   '["옆 · 앞 · 옆 · 앞 순서로 십자를 그려요", "돌아올 때는 같은 길을 거꾸로 되돌려요", "하나 · 둘 · 셋 · 넷 박자에 맞춰요"]'::jsonb,
   '["발이 모이거나 교차돼요 → 가는 쪽 발부터 옮기고 스탠스 폭을 그대로 지켜요", "박자가 빨라지며 가드가 내려가요 → 천천히 정확하게, 손은 턱 옆에 두고 해요"]'::jsonb,
   2, 5, 5::smallint),
  ('1530c4d0-0002-4a00-8000-000000001112'::uuid, '풋워크', '뛰는 스텝',
   '하나 · 둘 · 셋 박자로 가볍게 뛰며 앞 · 뒤 · 옆으로 움직여요',
   '스탠스를 유지한 채 앞꿈치로 가볍게 뛰면서 하나 · 둘 · 셋 박자로 이동해요. 앞으로 세 번, 뒤로 세 번, 옆으로도 세 번씩 움직여요. 높이 뛰지 말고 바닥을 스치듯 낮게 뛰어요.',
   '스텝 · 리듬', '초급',
   '["하나 · 둘 · 셋, 앞꿈치로 가볍게 뛰어요", "앞으로 세 번, 뒤로 세 번씩 움직여요", "옆으로 갈 때도 스탠스 그대로예요"]'::jsonb,
   '["높이 뛰어 몸이 들썩여요 → 바닥을 스치듯 낮게 뛰어요", "뛰다가 두 발이 나란히 서요 → 앞발 · 뒷발 자리를 지키며 움직여요"]'::jsonb,
   3, 6, 5::smallint),
  ('1530c4d0-0003-4a00-8000-000000001112'::uuid, '워밍업', '워킹 런지',
   '한 걸음씩 앞으로 내디디며 무릎을 굽혔다 펴요',
   '한 발을 앞으로 크게 내디디며 두 무릎을 천천히 굽혔다가, 뒷발을 앞으로 가져오며 다음 걸음으로 이어 가요. 뒷무릎은 바닥에 닿지 않게 테니스공 하나만큼 띄워요. 상체는 곧게 세우고 걸어가듯 천천히 해요.',
   '다리 · 균형', '초급',
   '["한 걸음 크게 내디뎌요", "뒷무릎은 바닥에서 테니스공 하나만큼 — 닿지 않게", "상체는 곧게 세우고 천천히 이어 가요"]'::jsonb,
   '["뒷무릎이 바닥에 쿵 닿아요 → 테니스공 하나만큼 띄우고 멈춰요", "앞무릎이 안쪽으로 모여요 → 무릎이 발끝 방향을 보게 해요"]'::jsonb,
   1, 90, 5::smallint),
  ('1530c4d0-0004-4a00-8000-000000001112'::uuid, '샌드백', '샌드백 구령',
   '코치님 구령에 맞춰 「어이」는 위빙 위빙 양훅, 「대시」는 한쪽만 빵빵',
   '샌드백 가까이 서서 코치님 구령을 기다려요. 「어이」 하면 위빙 · 위빙에 이어 양훅을 치고, 「대시」 하면 한쪽 방향으로만 하나 · 둘 빵빵 최대한 세게 쳐요. 다음 라운드는 반대쪽부터 해요.',
   '타이밍 · 콤비', '중급',
   '["코치님 구령에 맞춰요", "「어이」 = 위빙 · 위빙 → 양훅", "「대시」 = 한쪽만 하나 · 둘 빵빵, 강하고 빠르게"]'::jsonb,
   '["위빙할 때 머리가 대각선으로 먼저 떨어져요 → 무릎으로 먼저 내려갔다 올라와요", "세게 치다 자세가 무너져요 → 친 손은 바로 턱으로, 발은 스탠스 그대로"]'::jsonb,
   2, 215, 6::smallint)
) as v(id, category, name, summary, description, target, difficulty, cues, mistakes, level_min, sort_order, minutes)
where not exists (select 1 from public.training_exercises t where t.id = v.id or t.name = v.name);

-- ───────────────────────── 5) 「위빙」 카드 글 다듬기 (예전 글 그대로일 때만) ─────────────────────────
update public.training_exercises
   set summary = '무릎으로 U자를 그리며 훅 아래로 피해요',
       description = '무릎을 굽혀 머리를 아래로 떨어뜨린 뒤, U자를 그리며 반대쪽으로 올라와요. 뒤로 빠지지 말고 앞으로 가면서 짧게 해요 — 뒤로 빠지면 거리가 생겨 더 위험해요. 따라오는 발로 원래 스탠스를 만들어요.',
       cues = '["뒤로 말고 앞으로 가며 짧게", "머리는 대각선이 아니라 무릎으로 먼저 아래로", "따라오는 발로 원래 스탠스를 만들어요"]'::jsonb,
       mistakes = '["허리만 숙여 머리가 앞으로 쏠려요 → 무릎을 굽혀 아래로 내려가요", "뒤로 빠지며 피해요 → 앞으로 한 걸음 들어가며 짧게 피해요"]'::jsonb,
       updated_at = now()
 where name = '위빙'
   and category = '방어'
   and summary = 'U자로 상체를 숙여 훅을 피하는 기술.'
   and description = '무릎을 굽혀 U자를 그리듯 상체를 낮췄다 반대편으로 올라옵니다. 훅 계열 방어에 사용.'
   and cues = '["무릎으로 앉았다 반대편으로", "가드는 계속 유지"]'::jsonb
   and mistakes = '["허리만 숙여 무릎 안 씀", "위빙 후 가드가 열림"]'::jsonb;

-- ───────────────────────── 되돌리기 (필요할 때만 · 손으로) ─────────────────────────
-- update public.training_exercises set summary = 'U자로 상체를 숙여 훅을 피하는 기술.',
--   description = '무릎을 굽혀 U자를 그리듯 상체를 낮췄다 반대편으로 올라옵니다. 훅 계열 방어에 사용.',
--   cues = '["무릎으로 앉았다 반대편으로", "가드는 계속 유지"]'::jsonb,
--   mistakes = '["허리만 숙여 무릎 안 씀", "위빙 후 가드가 열림"]'::jsonb
--  where id = 'f294e207-515d-4c01-898b-5d930ea8cb4e' and summary = '무릎으로 U자를 그리며 훅 아래로 피해요';
-- delete from public.training_exercises where id in ('1530c4d0-0001-4a00-8000-000000001112', '1530c4d0-0002-4a00-8000-000000001112',
--   '1530c4d0-0003-4a00-8000-000000001112', '1530c4d0-0004-4a00-8000-000000001112');
-- alter policy tex_write on public.training_exercises
--   using (has_role(auth.uid(), 'super_admin') or has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'branch_manager') or has_role(auth.uid(), 'coach'))
--   with check (has_role(auth.uid(), 'super_admin') or has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'branch_manager') or has_role(auth.uid(), 'coach'));
-- drop policy "training videos member read" on storage.objects;  (coach read · hq insert 도 같게)
-- 저장소 training-videos 는 파일이 남아 있으면 지우지 않는다(대시보드에서 비운 뒤).
-- alter table public.training_exercises drop column video_path, drop column coach_video_path, drop column poster_path,
--   drop column minutes, drop column equipment;
