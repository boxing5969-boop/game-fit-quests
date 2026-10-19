-- 라이브보드(TV) 회원 정보 잠그기 1단계 (2026-10-19 대표님 "2번 진행")
--   예전: TV 가 로그인 없이 읽으려고 public_profiles(전 회원 이름·지점) · 출석(어제·오늘) · 운동 · 캐릭터 · 카드 표시를
--         누구나 읽게 열어 두었다 — 앱 주소와 공개 키만 알면 회원 3,400여 명 명단을 내려받을 수 있었다.
--   이제: TV 는 board_* 함수로 '오늘 그 지점에 온 회원'만 읽는다.
--         지점에 TV 열쇠가 걸리면(열쇠 주소로 처음 연 순간) 열쇠를 가진 TV 와 로그인한 그 지점 운영진만 읽는다.
--         실시간은 이름 없는 신호(board-ping:<지점>)만 보낸다 — TV 는 신호를 받으면 board_* 로 다시 읽는다.
--   2단계(20261019191000_live_board_revoke_anon.sql)에서 로그인 안 한 사람의 직접 읽기를 막는다 (TV 가 새 화면으로 바뀐 뒤).

-- 지점 이름 확인 + 열쇠 검사. 모르는 지점 = null, 열쇠가 걸렸는데 안 맞으면 board_key_required
create or replace function public._board_branch_ok(p_branch text, p_key text)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_required text;
  v_pending text;
begin
  select b.name into v_name
    from public.branches b
   where b.name = p_branch or (b.code is not null and b.code = p_branch)
   limit 1;
  if v_name is null then
    return null;
  end if;

  -- 로그인한 운영진은 열쇠 없이 — 전체관리자·관리자는 모든 지점, 지점장·코치는 자기 지점 (관리자 앱 미리보기)
  if v_uid is not null then
    if public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin') then
      return v_name;
    end if;
    if exists (select 1 from public.profiles p
                where p.user_id = v_uid and p.branch_name = v_name
                  and (coalesce(p.is_staff, false)
                       or public.has_role(v_uid, 'branch_manager')
                       or public.has_role(v_uid, 'coach'))) then
      return v_name;
    end if;
  end if;

  select c.value into v_required from public.internal_sync_config c where c.key = 'board_key:' || v_name;
  -- 대기 열쇠로 처음 열면 그 순간 잠근다 (get_board_qr_token 과 같은 규칙 — 대기 열쇠 줄은 남아도 잠긴 뒤엔 안 쓴다)
  if coalesce(v_required, '') = '' and coalesce(p_key, '') <> '' then
    select c.value into v_pending from public.internal_sync_config c where c.key = 'board_key_pending:' || v_name;
    if coalesce(v_pending, '') <> '' and p_key = v_pending then
      insert into public.internal_sync_config (key, value, updated_at)
      values ('board_key:' || v_name, v_pending, now())
      on conflict (key) do update set value = excluded.value, updated_at = now();
      v_required := v_pending;
    end if;
  end if;

  if coalesce(v_required, '') <> '' and coalesce(p_key, '') <> v_required then
    raise exception 'board_key_required';
  end if;
  return v_name;
end $$;
revoke all on function public._board_branch_ok(text, text) from public, anon, authenticated;

-- 오늘 이 지점 출석 (최근 500건)
create or replace function public.board_today_checkins(p_branch text, p_key text default null)
returns table(id uuid, user_id uuid, display_name_snapshot text, league_snapshot text, level_snapshot integer,
              checked_in_at timestamptz, is_duplicate boolean)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
#variable_conflict use_column
declare
  v_name text := public._board_branch_ok(p_branch, p_key);
begin
  if v_name is null then
    return;
  end if;
  return query
    select a.id, a.user_id, a.display_name_snapshot, a.league_snapshot, a.level_snapshot, a.checked_in_at,
           coalesce(a.is_duplicate, false)
      from public.attendance_logs a
     where a.branch_name = v_name
       and a.checked_in_at >= (((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul')
     order by a.checked_in_at desc
     limit 500;
end $$;

-- 지금 이 지점에서 앱으로 운동 중인 세션
create or replace function public.board_active_sessions(p_branch text, p_key text default null)
returns table(id uuid, user_id uuid, started_at timestamptz)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
#variable_conflict use_column
declare
  v_name text := public._board_branch_ok(p_branch, p_key);
begin
  if v_name is null then
    return;
  end if;
  return query
    select s.id, s.user_id, s.started_at
      from public.activity_sessions s
     where s.branch_name = v_name and s.status = 'active' and s.ended_at is null;
end $$;

-- 카드에 그릴 회원 정보 — 오늘 이 지점에 왔거나 지금 운동 중인 사람만 (아무 id 나 넣어 명단을 알아낼 수 없게)
create or replace function public.board_people(p_branch text, p_user_ids uuid[], p_key text default null)
returns table(user_id uuid, nickname text, avatar_url text, is_staff boolean, current_rank text, current_level integer,
              parts_json jsonb, card_mode text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
#variable_conflict use_column
declare
  v_name text := public._board_branch_ok(p_branch, p_key);
  v_start timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
begin
  if v_name is null then
    return;
  end if;
  return query
    select p.user_id, p.nickname, p.avatar_url, coalesce(p.is_staff, false),
           mp.current_rank::text, mp.current_level, cp.parts_json, d.mode
      from public.profiles p
      left join public.member_progress mp on mp.user_id = p.user_id
      left join public.member_character_assignments ca on ca.user_id = p.user_id and ca.is_active
      left join public.character_presets cp on cp.id = ca.preset_id
      left join public.member_card_display d on d.user_id = p.user_id
     where p.user_id = any((coalesce(p_user_ids, '{}'::uuid[]))[1:300])
       and (exists (select 1 from public.attendance_logs a
                     where a.user_id = p.user_id and a.branch_name = v_name and a.checked_in_at >= v_start)
            or exists (select 1 from public.activity_sessions s
                        where s.user_id = p.user_id and s.branch_name = v_name
                          and s.status = 'active' and s.ended_at is null));
end $$;

revoke all on function public.board_today_checkins(text, text) from public;
revoke all on function public.board_active_sessions(text, text) from public;
revoke all on function public.board_people(text, uuid[], text) from public;
grant execute on function public.board_today_checkins(text, text) to anon, authenticated;
grant execute on function public.board_active_sessions(text, text) to anon, authenticated;
grant execute on function public.board_people(text, uuid[], text) to anon, authenticated;

-- TV 열쇠 주소 — 그 지점 운영진(전체관리자·관리자 · 지점장 · 코치)만. 잠기기 전이면 대기 열쇠(없으면 새로)
create or replace function public.get_board_tv_key(p_branch text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_code text;
  v_key text;
  v_locked boolean := false;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다';
  end if;
  select b.name, b.code into v_name, v_code
    from public.branches b
   where b.name = p_branch or (b.code is not null and b.code = p_branch)
   limit 1;
  if v_name is null then
    raise exception '지점을 찾을 수 없어요';
  end if;
  if not (public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin')
          or exists (select 1 from public.profiles p
                      where p.user_id = v_uid and p.branch_name = v_name
                        and (coalesce(p.is_staff, false)
                             or public.has_role(v_uid, 'branch_manager')
                             or public.has_role(v_uid, 'coach')))) then
    raise exception '그 지점 운영진만 볼 수 있어요' using errcode = '42501';
  end if;

  select c.value into v_key from public.internal_sync_config c where c.key = 'board_key:' || v_name;
  if coalesce(v_key, '') <> '' then
    v_locked := true;
  else
    select c.value into v_key from public.internal_sync_config c where c.key = 'board_key_pending:' || v_name;
    if coalesce(v_key, '') = '' then
      v_key := substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10);
      insert into public.internal_sync_config (key, value, updated_at)
      values ('board_key_pending:' || v_name, v_key, now())
      on conflict (key) do update set value = excluded.value, updated_at = now();
    end if;
  end if;
  return jsonb_build_object('branch', v_name, 'code', v_code, 'key', v_key, 'locked', v_locked);
end $$;
revoke all on function public.get_board_tv_key(text) from public, anon;
grant execute on function public.get_board_tv_key(text) to authenticated;

-- 이름 없는 실시간 신호 — 출석이 들어오거나 운동 세션이 바뀌면 그 지점 TV 에 '다시 읽어요'만 알린다
create or replace function public._board_ping()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_branch text;
begin
  if tg_op = 'DELETE' then
    v_branch := old.branch_name;
  else
    v_branch := new.branch_name;
  end if;
  if v_branch is not null then
    begin
      perform realtime.send(jsonb_build_object('t', tg_table_name), 'changed', 'board-ping:' || v_branch, false);
    exception when others then
      null; -- 신호가 실패해도 출석·운동 기록은 그대로 (TV 는 1분마다 다시 읽는다)
    end;
  end if;
  return null;
end $$;
revoke all on function public._board_ping() from public, anon, authenticated;

create or replace trigger attendance_logs_board_ping
  after insert on public.attendance_logs
  for each row execute function public._board_ping();

create or replace trigger activity_sessions_board_ping
  after insert or update or delete on public.activity_sessions
  for each row execute function public._board_ping();
