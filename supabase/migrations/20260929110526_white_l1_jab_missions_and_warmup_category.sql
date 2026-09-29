-- 화이트 레벨 1 = 스탠스·가드·잽 (대표님 2026-09-29)
--  · 레벨 1 미션을 잽 3종(4스텝 잽 · 걷기 스텝 잽 · 백스텝 잽)으로 바꾼다 — 영상은 화이트 레벨 7 의 같은 영상
--  · 기존 레벨 1 줄넘기 3종은 '워밍업' 참고 영상으로 분류한다
--    (레벨 영상·레벨 미션 목록·진행률·미션 제출·레벨 심사 항목에서 빠지고, 워밍업 칸에만 보인다)
--
-- missions.category: 'level'(기본 · 레벨 미션) | 'warmup'(워밍업 참고 영상)
--   level_id 는 필수라 워밍업도 원래 레벨(화이트 1)에 둔 채로 분류만 바꾼다.

alter table public.missions add column if not exists category text not null default 'level';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'missions_category_check'
                    and conrelid = 'public.missions'::regclass) then
    alter table public.missions
      add constraint missions_category_check check (category in ('level', 'warmup'));
  end if;
end $$;

comment on column public.missions.category is
  '미션 분류 — level: 레벨 미션(레벨 영상·미션 제출·심사 항목), warmup: 워밍업 참고 영상(레벨 목록·진행률·심사에서 제외)';

-- 1) 화이트 레벨 1 줄넘기 3종 → 워밍업
update public.missions m
   set category = 'warmup'
  from public.levels l
 where l.id = m.level_id
   and l.rank_name = 'white' and l.level_number = 1
   and m.title like '[복싱/줄넘기]%'
   and m.category <> 'warmup';

-- 2) 화이트 레벨 1 잽 3종 — 재실행해도 중복 없이
with l1 as (
  select id from public.levels where rank_name = 'white' and level_number = 1
),
src (title, description, k1, k2, k3, sort_order, video_url, poster_url) as (
  values
  ('[복싱/잽] 4스텝 잽ㅣ리듬 스텝 위에서 옆 각도로 찌르는 잽',
   '리듬 스텝 위에서 옆으로 잽을 찌르고, 스텝으로 방향을 틀어 반대 각에서 다시 잽을 내는 기술입니다.',
   '리듬 스텝 위에서 옆으로 잽', '한 발로 밀어 스텝으로 방향 전환', '열린 반대 각에서 다시 잽',
   10, 'https://youtu.be/eCwpF3C45Kc', 'https://i.ytimg.com/vi/eCwpF3C45Kc/hqdefault.jpg'),
  ('[복싱/잽] 걷기 스텝 잽ㅣ걸으며 각도 만드는 잽',
   '걷는 스텝으로 압박하며 옆 각도로 잽을 찌르고, 발 방향을 바꿔 반대쪽에서 다시 잽을 꽂는 기술입니다. 정면에 머물지 않고 각도로 상대를 흔듭니다.',
   '걸으며 옆 각도로 잽', '발 방향을 바꿔 반대쪽으로 각 잡기', '각 잡고 다시 잽 — 상대가 계속 놓친다',
   20, 'https://youtu.be/3zYLlWfyY2k', 'https://i.ytimg.com/vi/3zYLlWfyY2k/hqdefault.jpg'),
  ('[복싱/잽] 백스텝 잽ㅣ잽 치고 빠졌다가 다시 찌르기',
   '잽을 치고 백스텝으로 빠졌다가 다시 들어가며 잽을 꽂는 인앤아웃 잽입니다. 리듬으로 상대의 거리를 못 맞추게 흔듭니다.',
   '앞손 잽으로 견제', '뒷발 먼저 백스텝으로 빠지며 반격 흘리기', '쫓아오는 순간 다시 파고들어 잽',
   30, 'https://youtu.be/oV2_1tfv_kc', 'https://i.ytimg.com/vi/oV2_1tfv_kc/hqdefault.jpg')
),
ins as (
  insert into public.missions
    (level_id, title, description, difficulty, xp_reward,
     key_point_1, key_point_2, key_point_3, sort_order, is_active, category)
  select l1.id, s.title, s.description, 1, 20, s.k1, s.k2, s.k3, s.sort_order, true, 'level'
    from src s cross join l1
   where not exists (select 1 from public.missions m where m.level_id = l1.id and m.title = s.title)
  returning id, title
)
insert into public.mission_videos (mission_id, source_type, video_url, poster_url)
select ins.id, 'external_url', s.video_url, s.poster_url
  from ins join src s on s.title = ins.title;

-- 3) 레벨 심사 항목에서 워밍업 제외 — 함수 본문은 그대로 두고 조건 한 줄만 붙인다
do $$
declare
  _def text; _new text;
  _add constant text := ' and m.category <> ''warmup''';
begin
  select pg_get_functiondef('public.get_level_review_checklist(uuid)'::regprocedure) into _def;
  _new := replace(_def,
    'where l.rank_name = _p.current_rank and l.level_number = _p.current_level and m.is_active = true;',
    'where l.rank_name = _p.current_rank and l.level_number = _p.current_level and m.is_active = true' || _add || ';');
  if length(_new) - length(_def) <> length(_add) then
    raise exception 'get_level_review_checklist: 바꿀 곳이 1곳이 아님';
  end if;
  execute _new;

  select pg_get_functiondef('public.set_level_review_check(uuid, uuid, boolean, text)'::regprocedure) into _def;
  _new := replace(_def,
    'where m.id = _mission_id and m.is_active = true',
    'where m.id = _mission_id and m.is_active = true' || _add);
  if length(_new) - length(_def) <> length(_add) then
    raise exception 'set_level_review_check: 바꿀 곳이 1곳이 아님';
  end if;
  execute _new;

  select pg_get_functiondef('public.approve_level_review(uuid, boolean, text)'::regprocedure) into _def;
  _new := replace(_def,
    'where l.rank_name = _p.current_rank and l.level_number = 10 and m.is_active = true',
    'where l.rank_name = _p.current_rank and l.level_number = 10 and m.is_active = true' || _add);
  if length(_new) - length(_def) <> 2 * length(_add) then
    raise exception 'approve_level_review: 바꿀 곳이 2곳이 아님';
  end if;
  execute _new;
end $$;