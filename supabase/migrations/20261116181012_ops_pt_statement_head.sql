-- PT 수당 2단계 2-3 — PT 명세서의 머리: 지급하는 곳 (2026-11-16 대표님 「올리고 적용 그리고 다음작업시작」
--   · 보고서 https://claude.ai/artifact/Dzy15seo1Y6ZWd2DapywyZ 「월 마감과 명세서」 · 「2단계 제작 계획」 2-3)
--
--   명세서(승인한 달의 줄을 회원별로 묶은 한 장)는 화면이 만든다 — 줄 · 합계 · 3.3%는 승인본(ops_pt_closes · ops_pt_close_list)
--   그대로다. 여기는 그 종이의 「지급하는 곳」(상호 · 대표자 · 사업자등록번호 · 주소 · 전화)만 내준다 — 계약서에 쓰는 사업주 정보
--   (ops_employers · 20261103191354_ops_contracts)와 같은 줄이고, 서명 그림은 주지 않는다.
--   보는 사람: 돈을 보는 분(_ops_can_see_pay — 대표님 · 회계매니저)과 그 지점 PT 코치 본인(자기 명세서의 지급자). 지점장은 못 본다.
--   새 함수 1 — 표 · 기존 함수 · 예약은 건드리지 않는다. 실제 사업주 정보는 이 파일에 없다(앱 화면에서 넣는다).

create or replace function public.ops_pt_statement_head(p_branch text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception '로그인이 필요해요'; end if;
  if not public._ops_can_see_pay(v_uid, p_branch) and public._ops_pt_my_staff(v_uid, p_branch) is null then
    raise exception 'PT 명세서를 볼 수 없어요';
  end if;
  return jsonb_build_object(
    'branch', p_branch,
    -- 사업주 정보를 아직 안 넣은 지점은 null — 명세서에는 지점 이름만 나온다
    'employer', (
      select jsonb_build_object('biz_name', e.biz_name, 'owner_name', e.owner_name, 'biz_number', e.biz_number,
                                'address', e.address, 'phone', e.phone)
        from public.ops_employers e
       where e.branch_name = p_branch));
end $$;

revoke all on function public.ops_pt_statement_head(text) from public, anon;
grant execute on function public.ops_pt_statement_head(text) to authenticated;
