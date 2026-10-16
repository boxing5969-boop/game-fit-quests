-- 🎂 생일 축하하기 (2026-10-16 대표님: "진행" — 앱에서 축하를 보내면 TV 생일 카드에 '축하 N개'로 쌓이게)
--
-- · 회원은 앱 홈에서 '오늘 생일인 동료'(오늘 이 지점에 운동하러 온 생일 회원)에게 한 번 눌러 축하를 보낸다.
--   같은 사람에게는 하루 한 번. 받은 사람에게 알림("🎂 생일 축하가 도착했어요").
-- · TV(get_live_board_birthdays)는 생일 회원 id 와 오늘 받은 축하 수를 받는다. 생년월일은 내보내지 않는다.
-- · 화면에 오지 않은(오늘 출석하지 않은) 회원의 생일은 누구에게도 알려 주지 않는다 — 보내기도 같은 조건.
-- · 표는 RLS 를 켜고 정책을 두지 않는다 (SECURITY DEFINER RPC 로만 읽고 쓴다, DM 과 같은 방식).

create table if not exists public.birthday_congrats (
  id uuid primary key default gen_random_uuid(),
  receiver_id uuid not null references auth.users (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  birthday_on date not null,
  message text check (message is null or char_length(message) <= 60),
  created_at timestamptz not null default now(),
  unique (receiver_id, sender_id, birthday_on)
);
create index if not exists birthday_congrats_receiver_day on public.birthday_congrats (receiver_id, birthday_on);
alter table public.birthday_congrats enable row level security;

/** 오늘(KST) 이 지점에 출석했거나 지금 운동 중인가 — TV '오늘 온 회원'과 같은 기준 */
create or replace function public._present_today(_uid uuid, _branch text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from attendance_logs a
            where a.user_id = _uid and a.branch_name = _branch
              and a.checked_in_at >= ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul')
      or exists (
           select 1 from activity_sessions s
            where s.user_id = _uid and s.branch_name = _branch and s.status = 'active' and s.ended_at is null)
$$;

/** 이 사람이 오늘 받은 생일 축하 수 */
create or replace function public._birthday_congrats_today(_uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from birthday_congrats
   where receiver_id = _uid and birthday_on = (now() at time zone 'Asia/Seoul')::date
$$;

-- ───────────────────────── TV ─────────────────────────
create or replace function public.get_live_board_birthdays(_branch_name text)
returns table (user_id uuid, congrats integer)
language sql
stable
security definer
set search_path = public
as $$
  select b.user_id, public._birthday_congrats_today(b.user_id)
    from public.get_live_board_birthday_members(_branch_name) b
$$;

-- ───────────────────────── 앱 홈 ─────────────────────────
/** 오늘 생일인 동료 (오늘 내 지점에 온 회원만) + 내 생일이면 받은 축하 */
create or replace function public.get_today_birthdays()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_branch text;
  v_hq boolean;
  v_rows jsonb;
  v_mine jsonb;
begin
  if v_uid is null then return jsonb_build_object('rows', '[]'::jsonb); end if;
  select * into v_me from public.profiles where user_id = v_uid;
  v_branch := v_me.branch_name;
  v_hq := exists (select 1 from public.user_roles r where r.user_id = v_uid and r.role::text in ('super_admin', 'admin'));
  if v_hq and (v_branch is null or not public.is_branch_visible(v_branch)) then
    v_branch := (select b.name from public.branches b where b.is_visible order by b.name limit 1);
  end if;

  if v_branch is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id', p.user_id,
             'name', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원'),
             'avatar_url', p.avatar_url,
             'league', coalesce(mp.current_rank, 'white'),
             'level', coalesce(mp.current_level, 1),
             'congrats', public._birthday_congrats_today(p.user_id),
             'sent', exists (select 1 from public.birthday_congrats c
                              where c.receiver_id = p.user_id and c.sender_id = v_uid
                                and c.birthday_on = (now() at time zone 'Asia/Seoul')::date)
           ) order by p.nickname), '[]'::jsonb)
      into v_rows
      from public.get_live_board_birthday_members(v_branch) b
      join public.profiles p on p.user_id = b.user_id
      left join public.member_progress mp on mp.user_id = p.user_id
     where p.user_id <> v_uid;
  end if;

  if public._is_birthday_today(v_me.birth_date) and not coalesce(v_me.is_staff, false) then
    v_mine := jsonb_build_object(
      'congrats', public._birthday_congrats_today(v_uid),
      'recent', coalesce((
        select jsonb_agg(x.name order by x.created_at desc)
          from (select coalesce(nullif(btrim(sp.nickname), ''), nullif(btrim(sp.name), ''), '회원') as name, c.created_at
                  from public.birthday_congrats c
                  join public.profiles sp on sp.user_id = c.sender_id
                 where c.receiver_id = v_uid and c.birthday_on = (now() at time zone 'Asia/Seoul')::date
                 order by c.created_at desc
                 limit 5) x), '[]'::jsonb));
  end if;

  return jsonb_build_object('branch', v_branch, 'rows', coalesce(v_rows, '[]'::jsonb), 'me', v_mine);
end $$;

/** 생일 축하 보내기 — 같은 사람에게 하루 한 번, 받은 사람에게 알림 */
create or replace function public.send_birthday_congrats(p_receiver uuid, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_me public.profiles%rowtype;
  v_to public.profiles%rowtype;
  v_hq boolean;
  v_msg text := nullif(left(btrim(coalesce(p_message, '')), 60), '');
  v_id uuid;
  v_sender text;
begin
  if v_uid is null then raise exception '다시 로그인해 주세요'; end if;
  if p_receiver is null or p_receiver = v_uid then raise exception '축하를 보낼 수 없어요'; end if;
  select * into v_me from public.profiles where user_id = v_uid;
  select * into v_to from public.profiles where user_id = p_receiver;
  v_hq := exists (select 1 from public.user_roles r where r.user_id = v_uid and r.role::text in ('super_admin', 'admin'));
  -- 오늘 생일이고 오늘 이 지점에 온 회원에게만 (같은 지점 회원 · 본사). 어떤 조건이 틀렸는지는 말하지 않는다.
  if v_to.user_id is null
     or coalesce(v_to.is_staff, false) or coalesce(v_to.is_test_account, false)
     or not public._is_birthday_today(v_to.birth_date)
     or not public._present_today(v_to.user_id, v_to.branch_name)
     or not (v_hq or v_me.branch_name = v_to.branch_name) then
    raise exception '지금은 축하를 보낼 수 없어요';
  end if;

  insert into public.birthday_congrats (receiver_id, sender_id, birthday_on, message)
  values (p_receiver, v_uid, v_today, v_msg)
  on conflict (receiver_id, sender_id, birthday_on) do nothing
  returning id into v_id;

  if v_id is not null then
    v_sender := coalesce(nullif(btrim(v_me.nickname), ''), nullif(btrim(v_me.name), ''), '동료');
    insert into public.notifications (user_id, title, body, link)
    values (p_receiver, '🎂 생일 축하가 도착했어요',
            left(v_sender || '님: ' || coalesce(v_msg, '생일 축하해요! 🎉'), 120), '/');
  end if;

  return jsonb_build_object('ok', true, 'already', v_id is null, 'congrats', public._birthday_congrats_today(p_receiver));
end $$;

revoke all on function public._present_today(uuid, text) from public, anon, authenticated;
revoke all on function public._birthday_congrats_today(uuid) from public, anon, authenticated;
revoke all on function public.get_live_board_birthdays(text) from public;
grant execute on function public.get_live_board_birthdays(text) to anon, authenticated;
revoke all on function public.get_today_birthdays() from public, anon;
grant execute on function public.get_today_birthdays() to authenticated;
revoke all on function public.send_birthday_congrats(uuid, text) from public, anon;
grant execute on function public.send_birthday_congrats(uuid, text) to authenticated;
