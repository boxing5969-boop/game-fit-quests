-- 라이브보드 153 레코드 표시 (2026-10-19 대표님: "가 적용시켜주고 10초정도 나도 적용시키자" · "그리고 라도 추가해줘")
--   가: 기록 보유자가 들어오면 금색 '153 RECORD' 환영 화면 10초
--   나: 운동하는 동안 그 회원 카드 맨 위가 금색 띠 '✦ 153 RECORD · 기록 이름'
--   라: 아래 '153 RECORD · 오늘 온 최초 기록 보유자' 금색 띠 (하루 종일)
-- TV 열쇠 길(_board_branch_ok)로만 읽는다. 오늘 그 지점에 왔거나 운동 중인 회원 중 153 레코드 '최초' 기록 보유자만.
-- 첫 대회 우승·준우승은 이미 TV 이름 옆에 메달이 보여 넣지 않는다(records_153 = 최초 기록만). 지도진은 뺀다.
-- 이름은 TV 의 다른 칸과 같은 규칙 — 앱 닉네임, 없으면 오늘 출석 기록의 이름.
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
           -- 기록 순서는 153 레코드 화면과 같게 (가입 → 출석 → 100회 → 글 → 붕대 → 레벨 10 → 리그 → PB → 체력)
           array_agg(public.record_153_label(r.record_key)
                     order by coalesce(array_position(array['first_signup','first_checkin','first_100_checkins','first_journal',
                                                            'first_handwrap','first_lv10','first_lv11','first_lv21','first_lv31',
                                                            'first_test153','first_fitness'], r.record_key), 99),
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

revoke all on function public.board_record_holders(text, text) from public;
grant execute on function public.board_record_holders(text, text) to anon, authenticated, service_role;
