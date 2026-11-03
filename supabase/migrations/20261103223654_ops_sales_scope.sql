-- 153운영본부 「매출」 탭 (2026-11-03 대표님 "153운영본부에 매출 자세히 알 수 있도록 해줘 · 일반 수강권 매출과 PT 매출을 분리해서")
--
--   매출은 돈이라 돈을 보는 분(_ops_can_see_pay — 대표님 · 대표님이 지정한 회계매니저)만 본다(10-29 규칙과 같다, 지점장 · 코치님은 안 보임).
--   이 함수는 볼 수 있는 지점을 알려 준다 — 화면은 이걸로 「매출」 탭을 보일지 정하고,
--   Edge Function ops-sales 도 부른 사람 토큰으로 이 함수를 다시 불러 확인한 뒤 153OS(브로제이 · 다짐 매출) · 앱 결제를 읽는다.
--   새 함수만 (기존 함수 · 표는 그대로).
create or replace function public.ops_sales_scope()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('branches', coalesce((
    select jsonb_agg(b.branch_name order by b.branch_name)
      from public.ops_branches b
     where b.enabled and public._ops_can_see_pay(auth.uid(), b.branch_name)), '[]'::jsonb));
$$;
revoke all on function public.ops_sales_scope() from public, anon;
grant execute on function public.ops_sales_scope() to authenticated;
