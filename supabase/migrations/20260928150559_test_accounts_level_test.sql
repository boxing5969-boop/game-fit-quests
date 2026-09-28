-- 체험용 계정 + 레벨 테스트 (2026-09-28, 대표님 요청)
--
-- 대표님: "건강행복 코치님 계정을 회원으로 바꿔 회원 경험을 해 보는 체험용 아이디로. 내 계정과 그 계정은 레벨을 바꿔
--          레벨 1·2·10·40 일 때 앱이 어떻게 열리고 움직이는지 테스트하게."
--
-- ① profiles.is_test_account — 체험용 계정. 앱은 회원과 똑같이 쓰지만 다른 회원이 보는 공개 순위(명예의 전당 ·
--    타이틀매치 정복자 · 리그 순위 · 라이벌 · 타이틀매치 소식 · 출석/활동/운동시간 순위 · 타임 크루 · 코너맨 후보 ·
--    153 챌린지 킹 보드 · 런칭 이벤트 · 지점 회원 수)에는 나오지 않는다. 켜고 끄는 건 전체 관리자·관리자만.
-- ② 레벨 테스트 — 전체 관리자 또는 체험용 계정이 **자기 계정만** 바꾼다.
--    set_test_level(리그, 레벨, 완주): 리그·레벨, 리그에 맞는 타이틀매치 통과 수(화이트 0 · 블루 1 · 레드 2 · 블랙 3,
--      블랙 L10 완주 = 4), 레벨 시작 시각 = 지금(승급 진행도 0부터), 마스터 트랙 꺼짐. 그 레벨과 이후 레벨의
--      심사 기록(level_status)은 지운다 — 예전 "심사 대기·통과" 가 남지 않게.
--      XP·젬·마일리지·출석은 건드리지 않는다(방금 승인된 심사 기록을 만들지 않으므로 마일리지 트리거도 안 탄다).
--    reset_test_level(): 처음 바꾸기 직전 상태(리그·레벨·타이틀매치·마스터 트랙·심사 기록)로 되돌린다.
--    get_test_level_state(): 화면용 — 쓸 수 있는지, 지금 상태, 되돌릴 원래 상태.

alter table public.profiles add column if not exists is_test_account boolean not null default false;

create table if not exists public.level_test_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null,
  level_status jsonb not null default '[]'::jsonb,
  level_status_history jsonb not null default '[]'::jsonb,
  taken_at timestamptz not null default now()
);
alter table public.level_test_snapshots enable row level security;
revoke all on table public.level_test_snapshots from anon, authenticated;

create or replace function public._can_test_level(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select _uid is not null and (
    public.has_role(_uid, 'super_admin')
    or exists (select 1 from public.profiles p where p.user_id = _uid and p.is_test_account));
$function$;

create or replace function public.get_test_level_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _uid uuid := auth.uid();
  _rank text; _level int; _bosses int; _overall int; _master int;
  _snap jsonb; _snap_at timestamptz;
begin
  if not public._can_test_level(_uid) then
    return jsonb_build_object('allowed', false);
  end if;
  select mp.current_rank::text, mp.current_level, mp.bosses_cleared, mp.overall_level, mp.master_level
    into _rank, _level, _bosses, _overall, _master
    from public.member_progress mp where mp.user_id = _uid;
  select s.progress, s.taken_at into _snap, _snap_at
    from public.level_test_snapshots s where s.user_id = _uid;
  return jsonb_build_object(
    'allowed', true,
    'is_test_account', exists (select 1 from public.profiles p where p.user_id = _uid and p.is_test_account),
    'current', jsonb_build_object('rank', _rank, 'level', _level, 'bosses', _bosses, 'overall', _overall, 'master_level', _master),
    'original', case when _snap is null then null else jsonb_build_object(
        'rank', _snap ->> 'current_rank', 'level', (_snap ->> 'current_level')::int,
        'bosses', (_snap ->> 'bosses_cleared')::int, 'master_level', coalesce((_snap ->> 'master_level')::int, 0),
        'taken_at', _snap_at) end);
end;
$function$;

create or replace function public.set_test_level(_rank text, _level integer, _complete boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _uid uuid := auth.uid();
  _ranks text[] := array['white', 'blue', 'red', 'black'];
  _rank_idx int;
  _pos int;
  _bosses int;
  _done boolean;
begin
  if not public._can_test_level(_uid) then
    raise exception '레벨 테스트는 체험용 계정과 전체 관리자만 쓸 수 있습니다';
  end if;
  _rank_idx := array_position(_ranks, _rank) - 1;
  if _rank_idx is null then raise exception '리그를 골라 주세요'; end if;
  if _level is null or _level < 1 or _level > 10 then raise exception '레벨은 1~10 사이로 골라 주세요'; end if;
  _done := coalesce(_complete, false) and _rank = 'black' and _level = 10;
  _bosses := _rank_idx + case when _done then 1 else 0 end;
  _pos := _rank_idx * 10 + _level;

  -- 원래 상태는 처음 바꿀 때 한 번만 보관 — 여러 번 바꿔도 "원래대로"는 테스트 전으로 간다.
  insert into public.level_test_snapshots (user_id, progress, level_status, level_status_history)
  select _uid,
         jsonb_build_object(
           'current_rank', mp.current_rank, 'current_level', mp.current_level, 'bosses_cleared', mp.bosses_cleared,
           'master_track_unlocked', mp.master_track_unlocked, 'master_level', mp.master_level,
           'level_started_at', mp.level_started_at, 'fast_track_gates', mp.fast_track_gates),
         coalesce((select jsonb_agg(to_jsonb(ls)) from public.level_status ls where ls.user_id = _uid), '[]'::jsonb),
         coalesce((select jsonb_agg(to_jsonb(h)) from public.level_status_history h where h.user_id = _uid), '[]'::jsonb)
    from public.member_progress mp
   where mp.user_id = _uid
  on conflict (user_id) do nothing;

  -- 그 레벨과 이후 레벨의 심사 기록은 지운다(이력은 cascade) — 예전 "심사 대기·통과" 가 새 테스트에 남지 않게.
  delete from public.level_status ls
   where ls.user_id = _uid
     and (array_position(_ranks, ls.rank_name::text) - 1) * 10 + ls.level_number >= _pos;

  update public.member_progress
     set current_rank = _rank::public.rank_name,
         current_level = _level,
         bosses_cleared = _bosses,
         level_started_at = now(),
         fast_track_gates = 0,
         master_track_unlocked = false,
         master_level = 0
   where user_id = _uid;
  if not found then raise exception '레벨 정보가 없는 계정입니다'; end if;

  return jsonb_build_object('ok', true, 'rank', _rank, 'level', _level, 'bosses', _bosses,
                            'overall', _pos, 'complete', _done);
end;
$function$;

create or replace function public.reset_test_level()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _uid uuid := auth.uid();
  _p jsonb; _ls jsonb; _lsh jsonb;
begin
  if not public._can_test_level(_uid) then
    raise exception '레벨 테스트는 체험용 계정과 전체 관리자만 쓸 수 있습니다';
  end if;
  select s.progress, s.level_status, s.level_status_history into _p, _ls, _lsh
    from public.level_test_snapshots s where s.user_id = _uid;
  if _p is null then
    return jsonb_build_object('ok', true, 'restored', false);
  end if;

  delete from public.level_status where user_id = _uid;   -- 이력은 cascade
  insert into public.level_status
    select * from jsonb_populate_recordset(null::public.level_status, coalesce(_ls, '[]'::jsonb));
  insert into public.level_status_history
    select * from jsonb_populate_recordset(null::public.level_status_history, coalesce(_lsh, '[]'::jsonb));

  update public.member_progress
     set current_rank = (_p ->> 'current_rank')::public.rank_name,
         current_level = (_p ->> 'current_level')::int,
         bosses_cleared = (_p ->> 'bosses_cleared')::int,
         master_track_unlocked = coalesce((_p ->> 'master_track_unlocked')::boolean, false),
         master_level = coalesce((_p ->> 'master_level')::int, 0),
         level_started_at = coalesce((_p ->> 'level_started_at')::timestamptz, now()),
         fast_track_gates = coalesce((_p ->> 'fast_track_gates')::int, 0)
   where user_id = _uid;

  delete from public.level_test_snapshots where user_id = _uid;
  return jsonb_build_object('ok', true, 'restored', true,
                            'rank', _p ->> 'current_rank', 'level', (_p ->> 'current_level')::int);
end;
$function$;

revoke all on function public._can_test_level(uuid) from public, anon, authenticated;
revoke all on function public.get_test_level_state() from public, anon;
revoke all on function public.set_test_level(text, integer, boolean) from public, anon;
revoke all on function public.reset_test_level() from public, anon;
grant execute on function public.get_test_level_state() to authenticated;
grant execute on function public.set_test_level(text, integer, boolean) to authenticated;
grant execute on function public.reset_test_level() to authenticated;

-- ③ 체험용 계정 표시는 전체 관리자·관리자만 바꾼다 — 회원이 스스로 켜면 레벨 테스트가 열리므로 막는다.
do $mig$
declare
  _def text;
  _pat text := 'if auth.uid() is null then return new; end if;';
begin
  select pg_get_functiondef(p.oid) into _def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'guard_profile_privileged_columns';
  if _def is null or (length(_def) - length(replace(_def, _pat, ''))) / length(_pat) <> 1 then
    raise exception 'guard_profile_privileged_columns: 기준 문구를 한 번 찾지 못함';
  end if;
  execute replace(_def, _pat, _pat || E'\n'
    || E'  -- 2026-09-28: 체험용 계정 표시는 전체 관리자·관리자만 바꾼다(켜면 레벨 테스트·공개 순위 제외가 따라온다).\n'
    || E'  if new.is_test_account is distinct from old.is_test_account\n'
    || E'     and not (public.has_role(auth.uid(), ''super_admin'') or public.has_role(auth.uid(), ''admin'')) then\n'
    || E'    raise exception ''체험용 계정 표시는 관리자만 바꿀 수 있습니다'';\n'
    || E'  end if;');
end
$mig$;

-- ④ 공개 순위·보드에서 체험용 계정 제외 — 각 함수의 지도진 제외 조건 바로 뒤에 붙인다(운영 정의 그대로, 한 곳만).
do $mig$
declare
  r record;
  _def text;
  _n int;
begin
  for r in
    select * from (values
      ('get_hall_of_fame',            'coalesce(p.is_staff, false) = false',  'coalesce(p.is_staff, false) = false and not coalesce(p.is_test_account, false)'),
      ('get_boss_conquerors',         'coalesce(p.is_staff, false) = false',  'coalesce(p.is_staff, false) = false and not coalesce(p.is_test_account, false)'),
      ('get_division_ranking',        'coalesce(p.is_staff, false) = false',  'coalesce(p.is_staff, false) = false and not coalesce(p.is_test_account, false)'),
      ('get_rivals_above',            'coalesce(p.is_staff, false) = false',  'coalesce(p.is_staff, false) = false and not coalesce(p.is_test_account, false)'),
      ('get_streak_ranking',          'coalesce(p.is_staff, false) = false',  'coalesce(p.is_staff, false) = false and not coalesce(p.is_test_account, false)'),
      ('get_titlematch_feed',         'coalesce(p.is_staff, false) = false',  'coalesce(p.is_staff, false) = false and not coalesce(p.is_test_account, false)'),
      ('get_weekly_activity_ranking', 'coalesce(p.is_staff, false) = false',  'coalesce(p.is_staff, false) = false and not coalesce(p.is_test_account, false)'),
      ('get_workout_time_ranking',    'coalesce(p.is_staff, false) = false',  'coalesce(p.is_staff, false) = false and not coalesce(p.is_test_account, false)'),
      ('_is_rankable_member',         'coalesce(p.is_staff, false) = false',  'coalesce(p.is_staff, false) = false and not coalesce(p.is_test_account, false)'),
      ('get_cornerman_candidates',    'COALESCE(p.is_staff, false) = false',  'COALESCE(p.is_staff, false) = false AND NOT COALESCE(p.is_test_account, false)'),
      ('get_time_crew',               'coalesce(pr.is_staff, false) = false', 'coalesce(pr.is_staff, false) = false and not coalesce(pr.is_test_account, false)'),
      ('get_branch_stats',            'and is_staff is not true',             'and is_staff is not true and is_test_account is not true')
    ) as v(fn, pat, rep)
  loop
    select pg_get_functiondef(p.oid) into _def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    if _def is null then raise exception '% 함수가 없음', r.fn; end if;
    _n := (length(_def) - length(replace(_def, r.pat, ''))) / length(r.pat);
    if _n <> 1 then raise exception '%: 기준 문구가 %번 (1번이어야 함)', r.fn, _n; end if;
    execute replace(_def, r.pat, r.rep);
  end loop;
end
$mig$;