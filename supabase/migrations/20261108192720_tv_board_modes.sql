-- 라이브보드 TV 화면 바꾸기 (2026-11-08 대표님 「라이브보드 탭에서 내가 버튼을 누르면 라이브보드 변경 가능하게해줘 모든 모드 별로」)
--   TV 번호(slot) = TV 를 켜는 주소 끝 번호 — 1 · 2 · 3 = /tv/<지점>/1 · /2 · /3, 4 = 번호 없는 /tv/<지점>(전체 한 화면).
--   관리자 앱 › 라이브보드에서 TV 번호마다 보여 줄 화면(mode)을 고르면 그 TV 가 몇 초 안에 그 화면으로 넘어가고,
--   다시 바꿀 때까지 그대로(TV 를 껐다 켜도). mode 'home' = 그 번호의 원래 화면 — 153 PB 측정 자동 전환은 이때만.
--   화면(mode): '1' 지금 운동 중 · '2' 런칭 이벤트 · '3' 회원 안내 카드뉴스 · '4' 전체 한 화면 · 'pb1' 153 PB 코스 · 'pb2' 153 PB 기록
--
--   tv_board_modes   지점 · TV 번호마다 고른 화면 (누가 · 언제)
--   tv_board_seen    TV 가 마지막으로 알려 준 지금 화면 · 시각 (앱에 '켜짐 · 지금 ○○' 로)
--   set_tv_board_mode(지점, 번호, 화면)        그 지점 운영진(get_board_tv_key 와 같은 기준) — 바꾸면 채널 tv-mode:<지점 이름> 으로 이름 없는 신호
--   get_tv_board_modes(지점)                   같은 운영진 — 번호 1~4 · 고른 화면 · TV 가 알려 준 화면 · 시각
--   board_tv_mode(지점, 열쇠, 번호, 지금 화면)  TV — 지금 화면을 알리고 고른 화면을 받는다 (TV 열쇠 _board_branch_ok)
--   새 표 2 · 새 함수 4 — 기존 함수 · 표는 그대로.

create table if not exists public.tv_board_modes (
  branch_name text not null,
  slot        text not null check (slot in ('1', '2', '3', '4')),
  mode        text not null check (mode in ('home', '1', '2', '3', '4', 'pb1', 'pb2')),
  set_by      uuid,
  set_at      timestamptz not null default now(),
  primary key (branch_name, slot)
);

create table if not exists public.tv_board_seen (
  branch_name text not null,
  slot        text not null check (slot in ('1', '2', '3', '4')),
  showing     text not null check (showing in ('1', '2', '3', '4', 'pb1', 'pb2')),
  seen_at     timestamptz not null default now(),
  primary key (branch_name, slot)
);

alter table public.tv_board_modes enable row level security;
alter table public.tv_board_seen enable row level security;
revoke all on table public.tv_board_modes from anon, authenticated;
revoke all on table public.tv_board_seen from anon, authenticated;

-- 그 지점 운영진인가 (get_board_tv_key 와 같은 기준) → 지점 이름
create or replace function public._tv_board_staff_branch(p_branch text)
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid  uuid := auth.uid();
  v_name text;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  select b.name into v_name
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
    raise exception '그 지점 운영진만 바꿀 수 있어요' using errcode = '42501';
  end if;
  return v_name;
end $function$;

create or replace function public.get_tv_board_modes(p_branch text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := public._tv_board_staff_branch(p_branch);
begin
  return jsonb_build_object(
    'branch', v_name,
    'now', now(),
    'slots', (
      select jsonb_agg(jsonb_build_object(
               'slot', s.slot,
               'mode', coalesce(m.mode, 'home'),
               'set_at', m.set_at,
               'set_by', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), '')),
               'showing', v.showing,
               'seen_at', v.seen_at
             ) order by s.slot)
        from (values ('1'), ('2'), ('3'), ('4')) as s(slot)
        left join public.tv_board_modes m on m.branch_name = v_name and m.slot = s.slot
        left join public.profiles p on p.user_id = m.set_by
        left join public.tv_board_seen v on v.branch_name = v_name and v.slot = s.slot
    )
  );
end $function$;

create or replace function public.set_tv_board_mode(p_branch text, p_slot text, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := public._tv_board_staff_branch(p_branch);
  v_mode text;
begin
  if p_slot is null or p_slot not in ('1', '2', '3', '4') then
    raise exception 'TV 번호가 잘못됐어요';
  end if;
  if p_mode is null or p_mode not in ('home', '1', '2', '3', '4', 'pb1', 'pb2') then
    raise exception '화면이 잘못됐어요';
  end if;
  -- 그 번호의 원래 화면을 고르면 '기본'(153 PB 자동 전환이 다시 켜진다)
  v_mode := case when p_mode = p_slot then 'home' else p_mode end;
  insert into public.tv_board_modes (branch_name, slot, mode, set_by, set_at)
  values (v_name, p_slot, v_mode, auth.uid(), now())
  on conflict (branch_name, slot) do update
     set mode = excluded.mode, set_by = excluded.set_by, set_at = excluded.set_at;
  -- 이름 없는 신호 — TV 는 받으면 board_tv_mode 로 다시 읽는다 (신호를 놓쳐도 1분 안에 따라간다)
  begin
    perform realtime.send(jsonb_build_object('slot', p_slot, 't', floor(extract(epoch from now()) * 1000)::bigint),
                          'mode', 'tv-mode:' || v_name, false);
  exception when others then
    null;
  end;
  return public.get_tv_board_modes(v_name);
end $function$;

create or replace function public.board_tv_mode(p_branch text, p_key text default null, p_slot text default null,
                                                p_showing text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := public._board_branch_ok(p_branch, p_key);
  v_mode text;
  v_at   timestamptz;
begin
  if v_name is null then
    return null;
  end if;
  if p_slot is null or p_slot not in ('1', '2', '3', '4') then
    return jsonb_build_object('branch', v_name, 'slot', null, 'mode', null, 'set_at', null);
  end if;
  if p_showing in ('1', '2', '3', '4', 'pb1', 'pb2') then
    insert into public.tv_board_seen (branch_name, slot, showing, seen_at)
    values (v_name, p_slot, p_showing, now())
    on conflict (branch_name, slot) do update set showing = excluded.showing, seen_at = excluded.seen_at;
  end if;
  select m.mode, m.set_at into v_mode, v_at
    from public.tv_board_modes m
   where m.branch_name = v_name and m.slot = p_slot;
  return jsonb_build_object('branch', v_name, 'slot', p_slot, 'mode', coalesce(v_mode, 'home'), 'set_at', v_at);
end $function$;

revoke all on function public._tv_board_staff_branch(text) from public, anon, authenticated;
revoke all on function public.get_tv_board_modes(text) from public, anon;
grant execute on function public.get_tv_board_modes(text) to authenticated, service_role;
revoke all on function public.set_tv_board_mode(text, text, text) from public, anon;
grant execute on function public.set_tv_board_mode(text, text, text) to authenticated, service_role;
revoke all on function public.board_tv_mode(text, text, text, text) from public;
grant execute on function public.board_tv_mode(text, text, text, text) to anon, authenticated, service_role;
