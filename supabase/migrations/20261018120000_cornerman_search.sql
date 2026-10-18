-- 운동 짝꿍 — 같은 지점 회원을 이름으로 찾기 (2026-10-18 대표님: "운동짝꿍에 같은 지점 회원 검색하는 기능 만들어줘")
--   get_cornerman_candidates 는 최근 출석한 30명만 보여 줘서 찾는 사람이 목록에 없을 수 있었다.
--   · 후보 목록과 같은 기준: 같은 지점 · 나 · 코치/지점장 · 테스트 계정은 뺀다 (전체관리자는 켜 둔 전 지점에서 둘러보기만)
--   · 이미 짝꿍이 있는 회원 · 요청이 오가는 중인 회원도 찾아 주고 state 로 알린다 — 요청은 available 만 (request_cornerman_pair 가 다시 확인)
--   · 앱에 보이는 이름(닉네임, 없으면 이름)으로만 찾는다 — 닉네임을 쓰는 회원의 실명이 드러나지 않게
--   · 화면: src/components/engagement/CornermanSheet.tsx 맨 위 찾기 칸
create or replace function public.search_cornerman_candidates(p_query text, p_limit integer default 20)
returns table(user_id uuid, display_name text, branch_name text, current_rank text, current_level integer, state text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_my_branch text;
  v_all boolean;
  v_q text := left(btrim(coalesce(p_query, '')), 30);
  v_pat text;
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if char_length(v_q) < 1 then return; end if;

  v_all := public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin');
  v_my_branch := public.boxing_cornerman_user_branch(v_uid);
  if not v_all and (v_my_branch is null or length(trim(v_my_branch)) = 0) then
    raise exception 'cornerman branch unknown';
  end if;

  -- % _ \ 는 글자 그대로 찾는다
  v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select s.user_id, s.display_name, s.branch_name, s.current_rank, s.current_level, s.state
    from (
      select p.user_id,
             coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원')::text as display_name,
             p.branch_name::text as branch_name,
             coalesce(mp.current_rank::text, 'white') as current_rank,
             coalesce(mp.current_level, 1) as current_level,
             (case
                when public.boxing_cornerman_has_active_pair(p.user_id) then 'paired'
                when exists (select 1 from public.boxing_cornerman_pairs cp
                              where cp.status = 'pending'
                                and ((cp.requester_user_id = v_uid and cp.receiver_user_id = p.user_id)
                                  or (cp.receiver_user_id = v_uid and cp.requester_user_id = p.user_id))) then 'pending'
                else 'available'
              end)::text as state,
             (select max(a.checked_in_at) from public.attendance_logs a where a.user_id = p.user_id) as last_at,
             p.created_at
        from public.profiles p
        left join public.member_progress mp on mp.user_id = p.user_id
       where p.user_id <> v_uid
         and ((v_all and public.is_branch_visible(p.branch_name)) or p.branch_name = v_my_branch)
         and coalesce(p.is_staff, false) = false
         and not coalesce(p.is_test_account, false)
         and not exists (select 1 from public.user_roles ur
                          where ur.user_id = p.user_id and ur.role::text <> 'member')
         and coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '회원') ilike v_pat
    ) s
   order by (s.state = 'available') desc, s.last_at desc nulls last, s.created_at desc
   limit v_limit;
end $$;

revoke all on function public.search_cornerman_candidates(text, integer) from public, anon;
grant execute on function public.search_cornerman_candidates(text, integer) to authenticated;
