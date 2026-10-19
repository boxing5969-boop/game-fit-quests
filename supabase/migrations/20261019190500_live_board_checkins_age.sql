-- 라이브보드 오늘 출석 — 들어온 지 몇 초인지(age_sec)도 함께 (2026-10-19)
--   얼굴 출석은 찍은 시각보다 평균 3분(최대 6분) 늦게 들어온다 → '찍은 시각'으로는 방금 들어온 출석을 못 가린다.
--   TV 는 age_sec(서버 기준, TV 시계가 틀려도 같다)가 짧은 새 출석에만 환영 화면을 띄운다.
--   board_today_checkins 는 쓰지 않으므로 앱 계정에서 실행 권한을 거둔다.
create or replace function public.board_checkins_today(p_branch text, p_key text default null)
returns table(id uuid, user_id uuid, display_name_snapshot text, league_snapshot text, level_snapshot integer,
              checked_in_at timestamptz, is_duplicate boolean, age_sec integer)
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
           coalesce(a.is_duplicate, false),
           greatest(0, extract(epoch from (now() - coalesce(a.created_at, a.checked_in_at))))::integer
      from public.attendance_logs a
     where a.branch_name = v_name
       and a.checked_in_at >= (((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul')
     order by a.checked_in_at desc
     limit 500;
end $$;
revoke all on function public.board_checkins_today(text, text) from public;
grant execute on function public.board_checkins_today(text, text) to anon, authenticated;

revoke execute on function public.board_today_checkins(text, text) from anon, authenticated;
