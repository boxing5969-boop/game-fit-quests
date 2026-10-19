-- 153 레코드 — '선릉역점 최초 가입자' 새 기록 + '마이복서153 최초 가입자' 이름 나누기 (2026-10-19 대표님:
--   "153복싱짐 선릉역점 최초 가입자 이성준 회원님이야 · 153마이복서 최초가입자도 있고")
--   · first_member_sunreung — 153복싱짐 선릉역점에 가장 먼저 등록한 회원. 앱 기록으로 셀 수 없어(개업일 2025-01-06 에
--     여러 명이 등록) 대표님이 정해 준 회원으로 새긴다. 날짜는 그 회원의 체육관 등록일.
--   · first_signup — '최초 가입자' → '마이복서153 최초 가입자' (앱에 직접 가입한 첫 회원, 기록 주인은 그대로)
--   새 기록도 다른 최초 기록과 같이 records_153 에 들어가므로 마일리지 10,000·알림(records_153_reward)이 같이 간다.
--   refresh_153_records 는 넣기만 하고(지우기·고치기 없음) 이 기록은 세지 않으므로 그대로 남는다.

create or replace function public.record_153_label(_key text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case _key
    when 'first_member_sunreung' then '선릉역점 최초 가입자'
    when 'first_signup' then '마이복서153 최초 가입자'
    when 'first_checkin' then '최초 출석'
    when 'first_100_checkins' then '최초 출석 100회'
    when 'first_journal' then '최초 커뮤니티 글'
    when 'first_handwrap' then '최초 붕대 감기 연습'
    when 'first_lv10' then '최초 레벨 10'
    when 'first_lv11' then '최초 블루리그 달성'
    when 'first_lv21' then '최초 레드리그 달성'
    when 'first_lv31' then '최초 블랙리그 달성'
    when 'first_test153' then '최초 153 PB 완주'
    when 'first_fitness' then '최초 체력테스트 기록'
    else _key end;
$function$;

-- TV(라이브보드) 기록 순서 — 선릉역점 최초 가입자가 맨 앞
create or replace function public.board_record_holders(p_branch text, p_key text default null)
 returns table(user_id uuid, name text, records text[], first_at timestamptz)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_name text := public._board_branch_ok(p_branch, p_key);
  v_start timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
begin
  if v_name is null then
    return;
  end if;
  return query
    with today_people as (
      select a.user_id, min(a.checked_in_at) as first_at,
             (array_agg(a.display_name_snapshot order by a.checked_in_at desc))[1] as snap_name
        from public.attendance_logs a
       where a.branch_name = v_name and a.checked_in_at >= v_start and a.user_id is not null
       group by a.user_id
      union all
      select s.user_id, min(s.started_at), null::text
        from public.activity_sessions s
       where s.branch_name = v_name and s.status = 'active' and s.ended_at is null
       group by s.user_id
    ), people as (
      select tp.user_id, min(tp.first_at) as first_at, max(tp.snap_name) as snap_name
        from today_people tp
       group by tp.user_id
    )
    select pe.user_id,
           coalesce(nullif(btrim(p.nickname), ''), pe.snap_name) as name,
           -- 기록 순서는 153 레코드 화면과 같게 (선릉역점 가입 → 앱 가입 → 출석 → 100회 → 글 → 붕대 → 레벨 10 → 리그 → PB → 체력)
           array_agg(public.record_153_label(r.record_key)
                     order by coalesce(array_position(array['first_member_sunreung','first_signup','first_checkin','first_100_checkins',
                                                            'first_journal','first_handwrap','first_lv10','first_lv11','first_lv21',
                                                            'first_lv31','first_test153','first_fitness'], r.record_key), 99),
                              r.achieved_at) as records,
           pe.first_at
      from people pe
      join public.records_153 r on r.user_id = pe.user_id
      left join public.profiles p on p.user_id = pe.user_id
     where coalesce(p.is_staff, false) = false
     group by pe.user_id, p.nickname, pe.snap_name, pe.first_at
     order by pe.first_at;
end
$function$;

-- 선릉역점 최초 가입자 — 이성준 회원님 (선릉역점에 그 이름이 딱 한 명일 때만 새긴다)
insert into public.records_153 (record_key, user_id, achieved_at)
select 'first_member_sunreung', p.user_id,
       (coalesce(p.gym_reg_date, date '2025-01-06'))::timestamp at time zone 'Asia/Seoul'
  from public.profiles p
 where replace(coalesce(p.name, ''), ' ', '') = '이성준'
   and p.branch_name = '153복싱짐 선릉역점'
   and coalesce(p.is_staff, false) = false
   and (select count(*) from public.profiles q
         where replace(coalesce(q.name, ''), ' ', '') = '이성준'
           and q.branch_name = '153복싱짐 선릉역점') = 1
on conflict (record_key) do nothing;
