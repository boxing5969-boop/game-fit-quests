-- 2026-09-28 라이브보드(TV) 레벨업 연출 복구 — 좁은 anon 조회 함수
--
-- 배경: 라이브보드 실시간 채널에 member_progress UPDATE 를 넣어 두었는데, member_progress 는 실시간 발행
-- (supabase_realtime publication)에 없어서 Realtime 이 그 채널의 구독을 통째로 등록하지 않았다
-- (운영 realtime.subscription 실측: TV 채널 0건 → 출석 이벤트도 한 건도 안 옴 → 보드는 20분 새로고침에만 갱신).
-- 채널에서 member_progress 를 빼고, 레벨업 연출은 출석 이벤트 뒤 이 함수로 그 회원의 리그·레벨만 다시 묻는다.
-- TV 는 로그인이 없어(anon) member_progress 를 RLS 로 읽을 수 없으므로, 오늘 이 지점에 출석한 회원으로만
-- 좁혀서 리그·레벨(보드에 이미 표시되는 값)만 돌려준다. 한 번에 최대 50명.
create or replace function public.get_board_member_levels(p_branch text, p_user_ids uuid[])
returns table(user_id uuid, current_rank text, current_level integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select mp.user_id, mp.current_rank::text, mp.current_level
    from public.member_progress mp
   where mp.user_id = any((coalesce(p_user_ids, '{}'::uuid[]))[1:50])
     and exists (
       select 1
         from public.attendance_logs a
        where a.user_id = mp.user_id
          and a.branch_name = p_branch
          and a.checked_in_at >= ((now() at time zone 'Asia/Seoul')::date::timestamp at time zone 'Asia/Seoul'));
$function$;

revoke all on function public.get_board_member_levels(text, uuid[]) from public;
grant execute on function public.get_board_member_levels(text, uuid[]) to anon, authenticated;