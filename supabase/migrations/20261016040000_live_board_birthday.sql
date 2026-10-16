-- 라이브보드 생일 회원 (2026-10-16 대표님: "생일 회원이 운동하러 오면 오로라 표시와 황금버튼, 생일축하 표시 —
--   다른 회원님들이 그 회원에게 축하하는 문화를 만들자")
--
-- TV 는 로그인하지 않아 생년월일을 읽을 수 없다. PT 배지(get_live_board_pt_members)와 같은 방식으로
-- DB 가 "오늘(KST) 생일이고, 오늘 이 지점에 출석했거나 지금 운동 중인 회원 id" 만 돌려준다.
-- 생년월일 자체는 내보내지 않는다. 화면에 오지 않은 회원의 생일은 알려 주지 않는다.
-- birth_date 는 글자 칸이라 'YYYY-MM-DD'·'YYYYMMDD'·'YYMMDD' 를 모두 읽는다. 2월 29일생은 평년엔 2월 28일.

create or replace function public._birth_mmdd(_birth text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when x.m between 1 and 12 and x.d between 1 and 31
              then lpad(x.m::text, 2, '0') || '-' || lpad(x.d::text, 2, '0') end
    from (
      select case when sep is not null then sep[2]::int
                  when length(s) >= 8 then substr(s, 5, 2)::int
                  when length(s) = 6 then substr(s, 3, 2)::int end as m,
             case when sep is not null then sep[3]::int
                  when length(s) >= 8 then substr(s, 7, 2)::int
                  when length(s) = 6 then substr(s, 5, 2)::int end as d
        from (select regexp_match(btrim(coalesce(_birth, '')), '^(\d{2,4})[-./ ](\d{1,2})[-./ ](\d{1,2})') as sep,
                     regexp_replace(coalesce(_birth, ''), '\D', '', 'g') as s) raw
    ) x
$$;

create or replace function public._is_birthday_today(_birth text)
returns boolean
language sql
stable
set search_path = public
as $$
  with t as (
    select (now() at time zone 'Asia/Seoul')::date as d, public._birth_mmdd(_birth) as mmdd
  )
  select coalesce(
           t.mmdd = to_char(t.d, 'MM-DD')
           or (t.mmdd = '02-29'
               and to_char(t.d, 'MM-DD') = '02-28'
               and extract(day from (date_trunc('year', t.d::timestamp) + interval '2 month' - interval '1 day')) = 28),
           false)
    from t
$$;

create or replace function public.get_live_board_birthday_members(_branch_name text)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with present as (
    select a.user_id
      from attendance_logs a
     where a.branch_name = _branch_name
       and a.user_id is not null
       and a.checked_in_at >= ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul'
    union
    select s.user_id
      from activity_sessions s
     where s.branch_name = _branch_name
       and s.user_id is not null
       and s.status = 'active'
       and s.ended_at is null
  )
  select p.user_id
    from present x
    join profiles p on p.user_id = x.user_id
   where coalesce(p.is_staff, false) = false
     and coalesce(p.is_test_account, false) = false
     and public._is_birthday_today(p.birth_date)
$$;

revoke all on function public._birth_mmdd(text) from public, anon, authenticated;
revoke all on function public._is_birthday_today(text) from public, anon, authenticated;
revoke all on function public.get_live_board_birthday_members(text) from public;
grant execute on function public.get_live_board_birthday_members(text) to anon, authenticated;
