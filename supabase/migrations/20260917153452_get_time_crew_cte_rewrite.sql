-- get_time_crew 재작성 (2026-09-17)
--
-- 두 가지를 고친다.
--   ① STABLE 함수 안에서 create temp table 은 불가하다
--      ("CREATE TABLE is not allowed in a non-volatile function" — 실측).
--      → CTE 한 줄로 계산한다.
--   ② 팀원 목록에 limit 1 을 집계 바깥에 걸어서 인원 제한이 안 걸렸다.
--      지점에 저녁 회원이 200명이면 200명이 전부 실려 나간다. 8명으로 제한한다.

create or replace function public.get_time_crew()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $fn$
declare
  v_uid uuid := auth.uid();
  v_branch text;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;

  v_branch := public.boxing_community_my_branch();
  if v_branch is null then
    return jsonb_build_object('success', true, 'slot', null, 'crewCount', 0,
                              'members', '[]'::jsonb, 'slots', '[]'::jsonb);
  end if;

  return (
    with base as (
      -- 최근 60일 · 하루 1회 인정된 출석만 · 같은 지점 · 직원 제외
      select al.user_id,
             case
               when extract(hour from (al.checked_in_at at time zone 'Asia/Seoul'))::int between 5 and 7   then 'dawn'
               when extract(hour from (al.checked_in_at at time zone 'Asia/Seoul'))::int between 8 and 11  then 'morning'
               when extract(hour from (al.checked_in_at at time zone 'Asia/Seoul'))::int between 12 and 14 then 'lunch'
               when extract(hour from (al.checked_in_at at time zone 'Asia/Seoul'))::int between 15 and 17 then 'afternoon'
               when extract(hour from (al.checked_in_at at time zone 'Asia/Seoul'))::int between 18 and 20 then 'evening'
               else 'night'
             end as slot
        from public.attendance_logs al
        join public.profiles pr on pr.user_id = al.user_id
       where coalesce(al.is_duplicate, false) = false
         and al.checked_in_at >= now() - interval '60 days'
         and pr.branch_name = v_branch
         and coalesce(pr.is_staff, false) = false
    ),
    per as (
      select user_id, slot, count(*)::int as visits,
             row_number() over (partition by user_id order by count(*) desc, slot) as rn
        from base group by user_id, slot
    ),
    top as (select user_id, slot, visits from per where rn = 1),
    mine as (select slot, visits from top where user_id = v_uid),
    dist as (select slot, count(*)::int as n from top group by slot)
    select jsonb_build_object(
      'success',    true,
      'branch',     v_branch,
      'slot',       (select slot from mine),
      'myVisits',   coalesce((select visits from mine), 0),
      -- 나를 뺀 같은 시간대 인원
      'crewCount',  greatest(coalesce((select n from dist where slot = (select slot from mine)), 1) - 1, 0),
      'members',    coalesce((
        select jsonb_agg(jsonb_build_object('nickname', p.nickname, 'visits', t.visits)
                 order by t.visits desc)
          from (
            select user_id, visits from top
             where slot = (select slot from mine) and user_id <> v_uid
             order by visits desc limit 8
          ) t
          join public.profiles p on p.user_id = t.user_id
      ), '[]'::jsonb),
      'slots',      coalesce((
        select jsonb_agg(jsonb_build_object('slot', slot, 'count', n)
                 order by array_position(
                   array['dawn','morning','lunch','afternoon','evening','night'], slot))
          from dist
      ), '[]'::jsonb)
    )
  );
end; $fn$;

revoke execute on function public.get_time_crew() from public;
grant execute on function public.get_time_crew() to authenticated;
