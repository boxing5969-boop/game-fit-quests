-- 🎬 한 동작에 영상 여러 버전 (실사 · 애니메이션) — 2026-10-01 대표님:
--   "4스텝 잽 애니메이션 영상을 원본 영상이랑 같이 나오게"
--
-- mission_videos 에 이름표(label)와 순서(sort_order)를 붙인다.
--   · sort_order 0 = 대표 영상 (목록 썸네일 · 처음 재생 · 코치 화면에서 고치는 영상)
--   · 1 이상 = 다른 버전 — 플레이어 위 '실사 | 애니메이션' 칸으로 바꿔 본다
--   · label 이 비어 있으면 화면에서 대표는 '실사', 나머지는 '영상 2' 처럼 부른다
-- 지금까지 영상은 한 동작에 하나뿐이라 전부 0(대표) 그대로다.
--
-- 4스텝 잽(1일차) 애니메이션: 따로 만든 카드('4스텝 잽 · 애니 여성', 7번째)에 있던 같은 영상 파일을
-- 원본 4스텝 잽 동작에 '애니메이션' 버전으로 붙이고, 따로 있던 카드는 목록에서 숨긴다 (지우지 않음 · is_active=false).
-- 수업 매뉴얼 1·3·4·6일차의 4스텝 잽 영상 버튼은 원본 동작을 가리키므로 거기서도 두 버전이 함께 보인다.

alter table public.mission_videos add column if not exists label text;
alter table public.mission_videos add column if not exists sort_order integer not null default 0;
comment on column public.mission_videos.label is '영상 이름표 — 실사 · 애니메이션 등 (비면 대표는 실사)';
comment on column public.mission_videos.sort_order is '0 = 대표 영상, 1 이상 = 다른 버전 (작은 수가 먼저)';

insert into public.mission_videos (mission_id, source_type, video_url, poster_url, duration_seconds, label, sort_order)
select '0eed6641-ed3d-48d9-897a-b62d64f04353'::uuid, v.source_type, v.video_url, v.poster_url, v.duration_seconds, '애니메이션', 1
  from public.mission_videos v
 where v.mission_id = 'a7c3e1f0-9d2b-4e86-b5a4-6f1c2d3e4a5b'::uuid
   and not exists (
     select 1 from public.mission_videos x
      where x.mission_id = '0eed6641-ed3d-48d9-897a-b62d64f04353'::uuid
        and x.video_url = v.video_url
   );

update public.missions
   set is_active = false
 where id = 'a7c3e1f0-9d2b-4e86-b5a4-6f1c2d3e4a5b'::uuid
   and exists (
     select 1 from public.mission_videos x
      where x.mission_id = '0eed6641-ed3d-48d9-897a-b62d64f04353'::uuid
        and x.label = '애니메이션'
   );