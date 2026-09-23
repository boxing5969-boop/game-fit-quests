-- TV2 런칭 이벤트 보드에 "현재 출석왕" 등재 (2026-09-23)
--
-- 대표님 지시: "현재 출석왕이 누구지? TV2 에 현재 출석왕 기록과 함께 등재해줘".
-- 이벤트 시작 전에도 TV 에 진짜 이름이 걸리도록, 응답에 current_attendance 를 덧붙인다:
--   month    — 이번 달(KST 1일~오늘) 지점 출석왕 Top 3 (출석 일수)
--   all_time — 기록 시작(2026-02)부터 지점 출석왕 Top 3 (출석 일수)
-- 점수는 _king_scores('attendance', …) 그대로 — 앱 킹 보드와 같은 계산.
create or replace function public.get_launch_event_board(p_branch text, p_limit integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_win jsonb := public.get_launch_event_window();
  v_since timestamptz := (v_win ->> 'since')::timestamptz;
  v_until timestamptz := (v_win ->> 'until')::timestamptz;
  v_status text := v_win ->> 'status';
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 20));
  v_cat text;
  v_items jsonb := '[]'::jsonb;
  v_rows jsonb;
  v_total integer;
  v_month_since timestamptz := (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
  v_cur_month jsonb;
  v_cur_all jsonb;
  v_first_day date;
begin
  if coalesce(btrim(p_branch), '') = '' then
    raise exception 'branch required';
  end if;

  -- 런칭 이벤트 세 왕좌
  foreach v_cat in array array['attendance', 'app', 'nickname'] loop
    if v_status = 'upcoming' then
      v_rows := '[]'::jsonb; v_total := 0;
    else
      with ranked as (
        select s.user_id, s.score,
               coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
               row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
          from public._king_scores(v_cat, v_since, v_until) s
          join public.profiles p on p.user_id = s.user_id
         where s.score > 0
           and coalesce(p.is_staff, false) = false
           and p.branch_name = p_branch
      )
      select coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'display_name', r.display_name, 'score', r.score) order by r.rnk)
                         from (select * from ranked order by rnk limit v_limit) r), '[]'::jsonb),
             (select count(*) from ranked)
        into v_rows, v_total;
    end if;
    v_items := v_items || jsonb_build_object('category', v_cat, 'board', v_rows, 'total', v_total);
  end loop;

  -- 현재 출석왕 (이번 달) Top 3
  with ranked as (
    select s.user_id, s.score,
           coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
           row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
      from public._king_scores('attendance', v_month_since, null) s
      join public.profiles p on p.user_id = s.user_id
     where s.score > 0 and coalesce(p.is_staff, false) = false and p.branch_name = p_branch
  )
  select coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'display_name', r.display_name, 'score', r.score) order by r.rnk)
                     from (select * from ranked order by rnk limit 3) r), '[]'::jsonb)
    into v_cur_month;

  -- 역대 출석왕 (기록 시작부터) Top 3
  select min((a.checked_in_at at time zone 'Asia/Seoul')::date) into v_first_day
    from public.attendance_logs a where coalesce(a.is_duplicate, false) = false;
  with ranked as (
    select s.user_id, s.score,
           coalesce(nullif(p.nickname, ''), nullif(p.name, ''), '익명 복서') as display_name,
           row_number() over (order by s.score desc, s.tie_at asc nulls last, s.user_id) as rnk
      from public._king_scores('attendance', timestamptz '2000-01-01', null) s
      join public.profiles p on p.user_id = s.user_id
     where s.score > 0 and coalesce(p.is_staff, false) = false and p.branch_name = p_branch
  )
  select coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'display_name', r.display_name, 'score', r.score) order by r.rnk)
                     from (select * from ranked order by rnk limit 3) r), '[]'::jsonb)
    into v_cur_all;

  return jsonb_build_object(
    'branch', p_branch, 'period', 'event', 'items', v_items,
    'current_attendance', jsonb_build_object(
      'month', jsonb_build_object('since', v_month_since, 'board', v_cur_month),
      'all_time', jsonb_build_object('since_date', v_first_day, 'board', v_cur_all)
    )
  ) || v_win;
end;
$$;
revoke all on function public.get_launch_event_board(text, integer) from public;
grant execute on function public.get_launch_event_board(text, integer) to anon, authenticated;
