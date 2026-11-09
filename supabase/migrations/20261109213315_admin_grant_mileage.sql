-- 🪙 회원에게 153 마일리지 지급 — 전체관리자(대표님) 계정만 (2026-11-09 대표님 「챔피언 머니처럼 회원님들 마일리지 드리는거
--   내 계정으로 할수있게 만들자」)
--   · 회원 상세 › 「153 마일리지」 칸의 '마일리지 지급' 줄이 부른다(MemberDetailPage · src/lib/mileageGrant.ts).
--   · 적립은 기존 grant_mileage 그대로 — kind 'adjust'(화면 이름 '사용·조정'), idem_key 'admin-grant:<준 사람>:<요청 id>'
--     → 같은 요청이 두 번 와도(두 번 눌림 · 다시 보내기) 한 번만 들어간다. 잔액 = 원장 합계(mileage_balance).
--     get_my_mileage_savings(아낀 금액)는 order-use · order-refund · desk 만 세므로 지급은 섞이지 않는다.
--   · 한 번에 1 ~ 100,000점 · 사유는 회원 마일리지 내역에 그대로 보인다(비우면 '153 보너스 마일리지') · 60자까지.
--   · 코치님 · 운영진 계정(is_staff · 운영진 역할)과 합쳐진 옛 계정(merged_into)에는 주지 않는다 — 적립 규칙과 같은 기준.
--   · p_notify = true 면 회원 알림함 + 휴대폰 알림(notifications → 푸시 트리거) 한 통 — 새로 들어갔을 때만.
--   · 새 함수만 추가 — 기존 함수 · 표 · 제약은 그대로.

create or replace function public.admin_grant_mileage(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_request_id uuid,
  p_notify boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reason text := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), '153 보너스 마일리지');
  v_ok boolean;
  v_balance integer;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'super_admin') then
    raise exception '전체관리자만 마일리지를 줄 수 있어요';
  end if;
  if p_user_id is null or p_request_id is null then
    raise exception '회원 정보가 없어요';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception '줄 점수를 입력해 주세요';
  end if;
  if p_amount > 100000 then
    raise exception '한 번에 100,000점까지 줄 수 있어요';
  end if;
  if char_length(v_reason) > 60 then
    raise exception '사유는 60자 안으로 적어 주세요';
  end if;
  if not exists (select 1 from public.profiles where user_id = p_user_id and merged_into is null) then
    raise exception '회원을 찾지 못했어요';
  end if;
  if exists (select 1 from public.profiles where user_id = p_user_id and coalesce(is_staff, false))
     or exists (select 1 from public.user_roles
                 where user_id = p_user_id and role in ('super_admin', 'admin', 'branch_manager', 'coach')) then
    raise exception '코치님 · 운영진 계정에는 마일리지를 줄 수 없어요';
  end if;

  v_ok := public.grant_mileage(p_user_id, 'adjust', p_amount, v_reason,
                               'admin-grant:' || auth.uid()::text || ':' || p_request_id::text, null);
  v_balance := public.mileage_balance(p_user_id);

  if v_ok and coalesce(p_notify, true) then
    insert into public.notifications (user_id, title, body, link)
    values (p_user_id,
            '153 마일리지 ' || to_char(p_amount, 'FM999,999,999') || '점이 들어왔어요',
            v_reason || ' · 지금 ' || to_char(v_balance, 'FM999,999,999') || '점 · 수강권 결제할 때 할인으로 쓸 수 있어요',
            '/mypage');
  end if;

  return jsonb_build_object('success', true, 'granted', coalesce(v_ok, false), 'amount', p_amount, 'balance', v_balance);
end $function$;

revoke all on function public.admin_grant_mileage(uuid, integer, text, uuid, boolean) from public, anon;
grant execute on function public.admin_grant_mileage(uuid, integer, text, uuid, boolean) to authenticated;
