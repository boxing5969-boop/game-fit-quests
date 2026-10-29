-- 랭킹 설명 단추 1단계 (2026-10-29 대표님 "니 추천대로 할게" · Claude Docs 「랭킹 설명 버튼 보고서」 https://claude.ai/artifact/8EJsSWmWQPaGEG2XaYye2e)
--   미리보기 단계라 새 함수만 더한다 (기존 함수 동작은 그대로).
--
--   1) get_my_ranking_positions() — '내 순위' 카드. 지금까지는 '전체' 50명 안에 들어야만 보였고(선릉 앱 회원 42명 중 22명은 안 보임),
--      다른 칩을 봐도 늘 '전체' 순위였다. → 칩 5개마다 내 순위 · 인원 · 바로 앞 사람과의 차이(앞 사람 값)를 서버가 한 번에 준다.
--      줄 세우기는 목록 함수와 같다: 내 지점 · 코치님 · 운영진(지점장 포함) · 테스트 계정 제외.
--        official : 레벨(리그×10 + 레벨) → 타이틀매치 통과 수 → 누적 XP → user_id (get_division_ranking 과 같은 순서)
--        weekly   : 이번 주(한국 월요일 0시부터) 받은 XP, 0 보다 클 때만
--        monthly  : 이번 달(한국 1일 0시부터) 받은 XP, 0 보다 클 때만
--        streak   : 출석 체크한 날 수(member_progress.streak_days — 연속이 아니라 누적), 1 이상
--        boss     : 타이틀매치 통과 수, 1 이상
--      XP · 날 수 순위는 같은 값이면 같은 순위(rank) — '앞 사람'은 나보다 값이 큰 사람 중 가장 가까운 사람.
--      코치님 · 운영진 · 테스트 계정이 부르면 {eligible:false} (카드를 그리지 않는다).
--
--   2) get_monthly_risers_v2(_branch_name, _limit) — '상승' 칩. get_monthly_risers 와 같은데
--      · 코치님 · 테스트 계정을 뺀다 (예전 것만 안 빼서 칠금 10월 상승 10위 안에 2명)
--      · 이번 달 = 한국 1일 0시부터 (예전 것은 서버 날짜라 1일 오전 9시부터)
--      · 이번 달 합이 0 보다 큰 사람만

create or replace function public.get_my_ranking_positions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_branch text;
  v_staff boolean;
  v_test boolean;
  v_week timestamptz := (date_trunc('week', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
  v_month timestamptz := (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
  v_out jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  select p.branch_name, coalesce(p.is_staff, false), coalesce(p.is_test_account, false)
    into v_branch, v_staff, v_test
    from public.profiles p
   where p.user_id = v_uid;

  if v_branch is null or v_staff or v_test
     or exists (select 1 from public.user_roles ur
                 where ur.user_id = v_uid and ur.role in ('super_admin', 'admin', 'branch_manager')) then
    return jsonb_build_object('eligible', false);
  end if;

  with elig as (
    select mp.user_id,
           (case mp.current_rank when 'white' then 0 when 'blue' then 10 when 'red' then 20 when 'black' then 30 else 0 end
            + coalesce(mp.current_level, 1)) as glevel,
           coalesce(mp.bosses_cleared, 0) as bosses,
           coalesce(mp.total_xp, 0) as xp,
           coalesce(mp.streak_days, 0) as days
      from public.member_progress mp
      join public.profiles p on p.user_id = mp.user_id
     where p.branch_name = v_branch
       and coalesce(p.is_staff, false) = false
       and not coalesce(p.is_test_account, false)
       and not exists (select 1 from public.user_roles ur
                        where ur.user_id = mp.user_id and ur.role in ('super_admin', 'admin', 'branch_manager'))
  ),
  off_rank as (
    select e.*, row_number() over (order by e.glevel desc, e.bosses desc, e.xp desc, e.user_id asc) as pos
      from elig e
  ),
  wk as (
    select x.user_id, sum(x.amount)::bigint as v
      from public.xp_logs x join elig e on e.user_id = x.user_id
     where x.created_at >= v_week
     group by x.user_id
    having sum(x.amount) > 0
  ),
  mo as (
    select x.user_id, sum(x.amount)::bigint as v
      from public.xp_logs x join elig e on e.user_id = x.user_id
     where x.created_at >= v_month
     group by x.user_id
    having sum(x.amount) > 0
  ),
  st as (select e.user_id, e.days::bigint as v from elig e where e.days > 0),
  bo as (select e.user_id, e.bosses::bigint as v from elig e where e.bosses > 0),
  scores as (
    select 'weekly'::text as k, user_id, v from wk
    union all select 'monthly', user_id, v from mo
    union all select 'streak', user_id, v from st
    union all select 'boss', user_id, v from bo
  ),
  mine as (
    select k, v from scores where user_id = v_uid
  ),
  per_kind as (
    select kinds.k,
           (select count(*) from scores s where s.k = kinds.k) as n,
           (select m.v from mine m where m.k = kinds.k) as me
      from (values ('weekly'), ('monthly'), ('streak'), ('boss')) as kinds(k)
  ),
  per_kind_full as (
    select pk.k, pk.n, pk.me,
           case when pk.me is null then null
                else 1 + (select count(*) from scores s where s.k = pk.k and s.v > pk.me) end as pos,
           (select min(s.v) from scores s where s.k = pk.k and s.v > coalesce(pk.me, 0)) as above
      from per_kind pk
  ),
  me_off as (select * from off_rank where user_id = v_uid),
  above_off as (
    select o.* from off_rank o, me_off m where o.pos = m.pos - 1
  )
  select jsonb_build_object(
    'eligible', true,
    'official', jsonb_build_object(
      'pos', (select pos from me_off),
      'n', (select count(*) from elig),
      'me', (select jsonb_build_object('lv', glevel, 'bosses', bosses, 'xp', xp) from me_off),
      'above', (select jsonb_build_object('lv', glevel, 'bosses', bosses, 'xp', xp) from above_off))
  ) || coalesce((
    select jsonb_object_agg(f.k, jsonb_build_object('pos', f.pos, 'n', f.n, 'me', coalesce(f.me, 0), 'above', f.above))
      from per_kind_full f
  ), '{}'::jsonb)
  into v_out;

  return v_out;
end $$;

revoke all on function public.get_my_ranking_positions() from public, anon;
grant execute on function public.get_my_ranking_positions() to authenticated;

create or replace function public.get_monthly_risers_v2(_branch_name text default null::text, _limit integer default 10)
returns table(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, monthly_xp bigint, rank_position bigint)
language sql
stable
security definer
set search_path = public
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
    xl.user_id, coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서'), p.avatar_url,
    mp.current_rank, mp.current_level,
    coalesce(sum(xl.amount), 0)::bigint as monthly_xp,
    row_number() over (order by coalesce(sum(xl.amount), 0) desc) as rank_position
  from xp_logs xl
  join profiles p on p.user_id = xl.user_id
  join member_progress mp on mp.user_id = xl.user_id
  cross join effective_filter ef
  where ((ef.branch_filter is null and public.is_branch_visible(p.branch_name)) or p.branch_name = ef.branch_filter)
    -- 이번 달 = 한국 1일 0시부터 (2026-10-29 — 예전 get_monthly_risers 는 서버 날짜라 1일 오전 9시부터였다)
    and xl.created_at >= (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul'
    -- 코치님 · 테스트 계정 제외 (다른 칩과 같게)
    and coalesce(p.is_staff, false) = false and not coalesce(p.is_test_account, false)
    and (
      ef.is_super_admin
      or not exists (
        select 1 from user_roles ur
         where ur.user_id = xl.user_id
           and ur.role in ('super_admin', 'admin', 'branch_manager')
      )
    )
    and not exists (
      select 1 from public.user_roles ur
       where ur.user_id = xl.user_id
         and ur.role in ('super_admin', 'admin')
    )
  group by xl.user_id, p.nickname, p.name, p.avatar_url, mp.current_rank, mp.current_level
  having coalesce(sum(xl.amount), 0) > 0
  order by monthly_xp desc
  limit _limit;
$function$;

revoke all on function public.get_monthly_risers_v2(text, integer) from public, anon;
grant execute on function public.get_monthly_risers_v2(text, integer) to authenticated;
