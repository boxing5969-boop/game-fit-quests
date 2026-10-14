-- 리그 뱃지용 (2026-10-15 대표님: 모든 회원 이름 옆 리그 뱃지)
-- 회원 아이디 목록 → 리그(white/blue/red/black)만 돌려준다. 리그는 랭킹에서 이미 공개되는 정보.
-- 지도진(is_staff)은 'champion' 으로 돌려 화면에서 리그 뱃지를 빼게 한다.
-- 적용: mcp apply_migration 으로 2026-10-15 운영 반영 완료. 이 파일은 기록용.
create or replace function public.get_member_leagues(p_ids uuid[])
returns table(user_id uuid, league text)
language sql
stable
security definer
set search_path = public
as $$
  select mp.user_id,
         case when coalesce(pr.is_staff, false) then 'champion' else coalesce(mp.current_rank::text, 'white') end
  from public.member_progress mp
  left join public.profiles pr on pr.user_id = mp.user_id
  where auth.uid() is not null
    and mp.user_id = any(p_ids[1:300]);
$$;

revoke all on function public.get_member_leagues(uuid[]) from public, anon;
grant execute on function public.get_member_leagues(uuid[]) to authenticated;
