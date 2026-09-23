-- 2026-09-23 BOXER 풀파워 검수 후속 ③ — 기존 랭킹에서 지도진(코치님) 제외
-- 대표님 지시: "코치님들은 모두 챔피언으로 해주고 레벨은 77로" → 코치님은 앱에서 '챔피언 · Lv.77' 로 표시한다(화면 전용).
-- 회원 리그 순위표에 코치님이 섞이면 표시와 순위가 어긋나므로, 회원 랭킹 7종에서 is_staff 를 뺀다.
-- (get_workout_time_ranking · 153 챌린지 킹 보드는 이미 제외)
-- 주간 활동 랭킹은 주 시작을 KST 월요일 0시로 바로잡는다 (기존: UTC CURRENT_DATE → 월요일 09시).

create or replace function public.get_division_ranking(_branch_name text default null::text, _limit integer default 50)
returns table(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, r_bosses_cleared integer, r_total_xp integer, r_streak_days integer, rank_position bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with caller_role as (
    select exists (
      select 1 from user_roles ur
       where ur.user_id = auth.uid() and ur.role = 'super_admin'
    ) as is_super_admin
  ),
  effective_filter as (
    select
      case when cr.is_super_admin then _branch_name
           else (select p.branch_name from profiles p where p.user_id = auth.uid())
      end as branch_filter,
      cr.is_super_admin
    from caller_role cr
  )
  select
    mp.user_id,
    -- 가입 직후 nickname 이 비어 있을 수 있어 fallback 처리.
    coalesce(nullif(p.nickname, ''), '익명' || substr(mp.user_id::text, 1, 6)) as r_nickname,
    p.avatar_url,
    mp.current_rank,
    mp.current_level,
    mp.bosses_cleared,
    mp.total_xp,
    mp.streak_days,
    row_number() over (
      order by
        (case mp.current_rank
           when 'white' then 0 when 'blue' then 10
           when 'red'   then 20 when 'black' then 30
           else 0
         end + coalesce(mp.current_level, 1)) desc,
        mp.bosses_cleared desc,
        mp.total_xp desc,
        mp.user_id asc -- 동률 안정 정렬
    ) as rank_position
  from member_progress mp
  left join profiles p on p.user_id = mp.user_id
  cross join effective_filter ef
  where
    (
      ef.branch_filter is null
      or p.branch_name = ef.branch_filter
    )
    -- 지도진(코치님)은 회원 순위에서 제외 — 앱에서는 '챔피언 · Lv.77' 로 따로 보인다
    and coalesce(p.is_staff, false) = false
    and (
      ef.is_super_admin
      or not exists (
        select 1 from user_roles ur
         where ur.user_id = mp.user_id
           and ur.role in ('super_admin', 'admin', 'branch_manager')
      )
    )
    -- 개발자·관리자(super_admin/admin) 계정은 전 뷰어에서 제외 (대표 요청)
    and not exists (
      select 1 from public.user_roles ur
       where ur.user_id = mp.user_id
         and ur.role in ('super_admin', 'admin')
    )
  order by rank_position
  limit _limit;
$function$;

create or replace function public.get_weekly_activity_ranking(_branch_name text default null::text, _limit integer default 20)
returns table(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, weekly_xp bigint, rank_position bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with caller_role as (
    select exists (
      select 1 from user_roles ur
       where ur.user_id = auth.uid() and ur.role = 'super_admin'
    ) as is_super_admin
  ),
  effective_filter as (
    select
      case when cr.is_super_admin then _branch_name
           else (select p.branch_name from profiles p where p.user_id = auth.uid())
      end as branch_filter,
      cr.is_super_admin
    from caller_role cr
  )
  select
    xl.user_id, p.nickname, p.avatar_url,
    mp.current_rank, mp.current_level,
    coalesce(sum(xl.amount), 0)::bigint as weekly_xp,
    row_number() over (order by coalesce(sum(xl.amount), 0) desc) as rank_position
  from xp_logs xl
  join profiles p on p.user_id = xl.user_id
  join member_progress mp on mp.user_id = xl.user_id
  cross join effective_filter ef
  where (ef.branch_filter is null or p.branch_name = ef.branch_filter)
    -- 이번 주 = KST 월요일 0시부터
    and xl.created_at >= (date_trunc('week', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul'
    and coalesce(p.is_staff, false) = false
    and (
      ef.is_super_admin
      or not exists (
        select 1 from user_roles ur
         where ur.user_id = xl.user_id
           and ur.role in ('super_admin', 'admin', 'branch_manager')
      )
    )
    -- 개발자·관리자(super_admin/admin) 계정은 전 뷰어에서 제외 (대표 요청)
    and not exists (
      select 1 from public.user_roles ur
       where ur.user_id = xl.user_id
         and ur.role in ('super_admin', 'admin')
    )
  group by xl.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level
  order by weekly_xp desc
  limit _limit;
$function$;

create or replace function public.get_streak_ranking(_branch_name text default null::text, _limit integer default 10)
returns table(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, r_streak_days integer, rank_position bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with caller_role as (
    select exists (
      select 1 from user_roles ur
       where ur.user_id = auth.uid() and ur.role = 'super_admin'
    ) as is_super_admin
  ),
  effective_filter as (
    select
      case when cr.is_super_admin then _branch_name
           else (select p.branch_name from profiles p where p.user_id = auth.uid())
      end as branch_filter,
      cr.is_super_admin
    from caller_role cr
  )
  select
    mp.user_id, p.nickname, p.avatar_url,
    mp.current_rank, mp.current_level, mp.streak_days,
    row_number() over (order by mp.streak_days desc) as rank_position
  from member_progress mp
  join profiles p on p.user_id = mp.user_id
  cross join effective_filter ef
  where (ef.branch_filter is null or p.branch_name = ef.branch_filter)
    and mp.streak_days > 0
    and coalesce(p.is_staff, false) = false
    and (
      ef.is_super_admin
      or not exists (
        select 1 from user_roles ur
         where ur.user_id = mp.user_id
           and ur.role in ('super_admin', 'admin', 'branch_manager')
      )
    )
    -- 개발자·관리자(super_admin/admin) 계정은 전 뷰어에서 제외 (대표 요청)
    and not exists (
      select 1 from public.user_roles ur
       where ur.user_id = mp.user_id
         and ur.role in ('super_admin', 'admin')
    )
  order by mp.streak_days desc
  limit _limit;
$function$;

create or replace function public.get_boss_conquerors(_branch_name text default null::text, _limit integer default 10)
returns table(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, r_bosses_cleared integer, rank_position bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with caller_role as (
    select exists (
      select 1 from user_roles ur
       where ur.user_id = auth.uid() and ur.role = 'super_admin'
    ) as is_super_admin
  ),
  effective_filter as (
    select
      case when cr.is_super_admin then _branch_name
           else coalesce(
                  (select p.branch_name from profiles p where p.user_id = auth.uid()),
                  _branch_name)
      end as branch_filter,
      cr.is_super_admin
    from caller_role cr
  )
  select
    mp.user_id, p.nickname, p.avatar_url,
    mp.current_rank, mp.current_level, mp.bosses_cleared,
    row_number() over (order by mp.bosses_cleared desc) as rank_position
  from member_progress mp
  join profiles p on p.user_id = mp.user_id
  cross join effective_filter ef
  -- 전 지점 조회는 super_admin 만. 나머지는 반드시 지점이 일치해야 한다.
  where ((ef.is_super_admin and ef.branch_filter is null) or p.branch_name = ef.branch_filter)
    and mp.bosses_cleared > 0
    and coalesce(p.is_staff, false) = false
    and (
      ef.is_super_admin
      or not exists (
        select 1 from user_roles ur
         where ur.user_id = mp.user_id
           and ur.role in ('super_admin', 'admin', 'branch_manager')
      )
    )
    -- 개발자·관리자(super_admin/admin) 계정은 전 뷰어에서 제외 (대표 요청)
    and not exists (
      select 1 from public.user_roles ur
       where ur.user_id = mp.user_id
         and ur.role in ('super_admin', 'admin')
    )
  order by mp.bosses_cleared desc
  limit _limit;
$function$;

create or replace function public.get_hall_of_fame(_limit integer default 20)
returns table(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, r_bosses_cleared integer, r_total_xp integer, r_branch_name text, rank_position bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    mp.user_id, p.nickname, p.avatar_url, mp.current_rank, mp.current_level,
    mp.bosses_cleared, mp.total_xp, p.branch_name,
    row_number() over (
      order by mp.overall_level desc,
               mp.bosses_cleared desc,
               mp.total_xp desc
    ) as rank_position
  from member_progress mp
  join profiles p on p.user_id = mp.user_id
  where mp.current_rank = 'black' and mp.current_level = 10
    and coalesce(p.is_staff, false) = false
    and not exists (
      select 1 from user_roles ur
       where ur.user_id = mp.user_id
         and ur.role in ('super_admin', 'admin', 'branch_manager')
    )
    -- 개발자·관리자(super_admin/admin) 계정은 전 뷰어에서 제외 (대표 요청)
    and not exists (
      select 1 from public.user_roles ur
       where ur.user_id = mp.user_id
         and ur.role in ('super_admin', 'admin')
    )
  order by mp.overall_level desc,
           mp.bosses_cleared desc,
           mp.total_xp desc
  limit _limit;
$function$;

create or replace function public.get_rivals_above(_user_id uuid, _count integer default 3)
returns table(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, r_bosses_cleared integer, r_total_xp integer, r_streak_days integer, rank_position bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with my_branch as (
    select branch_name from profiles where profiles.user_id = _user_id
  ),
  ranked as (
    select
      mp.user_id,
      p.nickname,
      p.avatar_url,
      mp.current_rank,
      mp.current_level,
      mp.bosses_cleared,
      mp.total_xp,
      mp.streak_days,
      row_number() over (
        order by rank_order(mp.current_rank) desc,
                mp.current_level desc,
                mp.bosses_cleared desc,
                mp.total_xp desc
      ) as rank_position
    from member_progress mp
    join profiles p on p.user_id = mp.user_id
    where p.branch_name = (select branch_name from my_branch)
      and coalesce(p.is_staff, false) = false
      -- 개발자·관리자(super_admin/admin) 계정은 라이벌 랭킹에서 제외 (대표 요청)
      and not exists (
        select 1 from public.user_roles ur
         where ur.user_id = mp.user_id
           and ur.role in ('super_admin', 'admin')
      )
  ),
  my_pos as (
    select rank_position from ranked where ranked.user_id = _user_id
  )
  select r.user_id, r.nickname, r.avatar_url, r.current_rank, r.current_level,
         r.bosses_cleared, r.total_xp, r.streak_days, r.rank_position
  from ranked r, my_pos m
  where r.rank_position < m.rank_position
  order by r.rank_position desc
  limit _count;
$function$;

create or replace function public.is_caller_in_hall_of_fame()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from member_progress mp
     join profiles p on p.user_id = mp.user_id
     where mp.user_id = auth.uid()
       and mp.current_rank = 'black'
       and mp.current_level = 10
       and coalesce(p.is_staff, false) = false
       and not exists (
         select 1 from user_roles ur
          where ur.user_id = mp.user_id
            and ur.role in ('super_admin', 'admin', 'branch_manager')
       )
  );
$function$;
