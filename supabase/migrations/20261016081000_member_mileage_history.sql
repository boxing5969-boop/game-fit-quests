-- 회원 마일리지 받은 기록 전부 보기 (2026-10-16 대표님: "회원님 마일리지 어떻게 받은건지 기록을 볼수있도록 해줘~")
--   회원 상세(개요 탭) 마일리지 칸이 최근 20건만 받아 5건만 보여 줬다 → 종류별 합계 + 내역 전부(최근 500건)
--   권한은 그대로: 전체관리자 · 같은 지점 지점장 (is_same_branch)
--   kind: attendance(출석) · level_up(레벨업) · title_match(타이틀매치) · record(153 레코드) · adjust(데스크 사용·회수 등)

create or replace function public.get_member_mileage(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not (public.has_role(auth.uid(), 'super_admin') or public.is_same_branch(p_user_id)) then
    raise exception '지점장·전체관리자만 볼 수 있어요';
  end if;
  return jsonb_build_object(
    'balance', public.mileage_balance(p_user_id),
    'count', (select count(*) from public.mileage_ledger where user_id = p_user_id),
    'summary', coalesce((
      select jsonb_agg(jsonb_build_object('kind', s.kind, 'count', s.n, 'earned', s.earned, 'spent', s.spent)
                       order by s.earned desc, s.spent)
        from (select kind, count(*) as n,
                     coalesce(sum(amount) filter (where amount > 0), 0) as earned,
                     coalesce(sum(amount) filter (where amount < 0), 0) as spent
                from public.mileage_ledger where user_id = p_user_id group by kind) s), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('amount', x.amount, 'kind', x.kind, 'reason', x.reason, 'at', x.created_at)
                       order by x.created_at desc)
        from (select amount, kind, reason, created_at from public.mileage_ledger
               where user_id = p_user_id order by created_at desc limit 500) x), '[]'::jsonb)
  );
end $$;
