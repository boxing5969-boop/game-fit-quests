-- 라이브 보드(TV) 마이복서153 랭킹 1·2·3위 (2026-10-15 대표님)
--   · 앱 랭킹 '전체' 탭(get_division_ranking)과 같은 순서:
--     레벨(리그×10 + 레벨) 높은 순 → 보스(타이틀매치) 클리어 많은 순 → 누적 XP 많은 순
--   · 같은 제외 규칙: 지도진(코치님) · 테스트 계정 · 관리자 계정
--   · TV 는 로그인 없이(anon) 켜 두므로 지점 이름을 받아 그 지점만, 닉네임·레벨만 돌려준다
create or replace function public.get_live_board_top3(p_branch_name text, p_limit integer default 3)
returns table(r_user_id uuid, r_nickname text, r_avatar_url text, r_current_rank rank_name, r_current_level integer, r_position bigint)
language sql stable security definer set search_path to 'public' as $$
  select mp.user_id,
         coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '익명 복서'),
         p.avatar_url,
         mp.current_rank,
         mp.current_level,
         row_number() over (
           order by (case mp.current_rank when 'white' then 0 when 'blue' then 10
                                          when 'red' then 20 when 'black' then 30 else 0 end
                     + coalesce(mp.current_level, 1)) desc,
                    mp.bosses_cleared desc, mp.total_xp desc, mp.user_id asc)
    from public.member_progress mp
    join public.profiles p on p.user_id = mp.user_id
   where p.branch_name = p_branch_name
     and coalesce(p.is_staff, false) = false
     and not coalesce(p.is_test_account, false)
     and not exists (select 1 from public.user_roles ur
                      where ur.user_id = mp.user_id and ur.role in ('super_admin', 'admin', 'branch_manager'))
   order by 6
   limit least(greatest(coalesce(p_limit, 3), 1), 10);
$$;
revoke all on function public.get_live_board_top3(text, integer) from public;
grant execute on function public.get_live_board_top3(text, integer) to anon, authenticated;
