-- 153 레코드 금띠 — 최초 대회 우승 · 준우승자도 (2026-10-29 대표님: "최초 대회 우승 준우승자도 레코드 금띠 나오게 해줘")
--   · 예전(2026-10-19)엔 '대회 메달은 이미 이름 옆에 있어 제외'였다 → 이제 153복싱짐 최초 대회(get_153_records 의 'tournament' 와 같은 대회)
--     금(우승) · 은(준우승) 수상자도 TV 153 레코드 보유자로 본다 → 가(입장 금색 환영) · 나(카드 맨 위 금색 띠) · 라(아래 금색 띠) 모두.
--   · 최초 대회 고르는 법은 get_153_records(20261016070000) 와 똑같이 — 금·은이 나온 대회 중 대회일(없으면 등록일)이 가장 이른 것 하나.
--   · 기록 이름: '최초 대회 우승' / '최초 대회 준우승' — 다른 최초 기록보다 앞에 둔다.
--   · 앱 가입 전(user_id 없음) 메달은 TV 에 띄울 사람이 없으니 빠진다. 코치님(staff)은 지금처럼 금띠 없음(코치 카드는 따로).
--   · 반환 모양 · 권한은 그대로 (create or replace — 프론트 LiveBoardPage 는 고칠 것 없음).

create or replace function public.board_record_holders(p_branch text, p_key text default null::text)
 returns table(user_id uuid, name text, records text[], first_at timestamp with time zone)
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
    ), first_event as (
      select m.event_title
        from public.member_medals m
       where m.medal in ('gold', 'silver')
       group by m.event_title
       order by min(coalesce(m.event_date, (m.created_at at time zone 'Asia/Seoul')::date)), min(m.created_at), m.event_title
       limit 1
    ), labels as (
      -- 최초 대회 우승 · 준우승 (맨 앞)
      select m.user_id,
             case m.medal when 'gold' then '최초 대회 우승' else '최초 대회 준우승' end as label,
             case m.medal when 'gold' then -2 else -1 end as ord,
             m.created_at as at
        from first_event fe
        join public.member_medals m on m.event_title = fe.event_title and m.medal in ('gold', 'silver')
       where m.user_id is not null
      union all
      -- 153 레코드 '최초' 기록 (예전 그대로)
      select r.user_id,
             public.record_153_label(r.record_key),
             coalesce(array_position(array['first_member_sunreung','first_signup','first_app_payment','first_checkin',
                                           'first_100_checkins','first_journal','first_journal_photo','first_handwrap','first_lv10','first_lv11',
                                           'first_lv21','first_lv31','first_test153','first_test153_top_m',
                                           'first_test153_top_f','first_fitness'], r.record_key), 99),
             r.achieved_at
        from public.records_153 r
    )
    select pe.user_id,
           coalesce(nullif(btrim(p.nickname), ''), pe.snap_name) as name,
           array_agg(l.label order by l.ord, l.at) as records,
           pe.first_at
      from people pe
      join labels l on l.user_id = pe.user_id
      left join public.profiles p on p.user_id = pe.user_id
     where coalesce(p.is_staff, false) = false
     group by pe.user_id, p.nickname, pe.snap_name, pe.first_at
     order by pe.first_at;
end
$function$;
