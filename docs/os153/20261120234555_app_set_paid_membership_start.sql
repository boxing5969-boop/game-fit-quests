-- ⚠️ 153OS DB(tbxdrfowanyksgdicryl)에 넣는 함수 — 마이복서153 앱 DB 가 아니다(supabase/migrations 에 두지 않는 까닭).
--    153OS 저장소(153-boxing-os)는 손대지 않는 약속이라 앱이 부르는 153OS 함수는 여기에 적어 둔다
--    (같은 길: app_refund_paid_membership — 2026-10-27, 153OS DB 에만 있음).
--
-- 앱 결제 수강권의 시작일을 앱과 같은 날로 (2026-11-20 대표님: "회원님들이 수강권 결제할때 시작일을 지정할수있게하자.
--   미리등록하려는분들도있고 신규인데 다음주부터 하고싶은 사람도 있으니까")
--
--   앱 결제가 끝나면 payssam-callback → 153OS 워커 /api/external/me/sync-paid → app_sync_paid_membership →
--   app_activate_paid_membership 이 이용권 · 출입권한을 늘 '오늘(서버 날짜 UTC)부터 + N개월'로 만든다.
--   그래서 ① 회원이 고른 시작일(다음 주)이 153OS 에 안 들어가고 ② 미리 결제(이어서)도 지금 이용권과 겹쳐 잡히고
--   ③ 한국 아침 9시 전 결제는 하루 앞당겨졌다 — 153OS → 앱 동기화(sync-members-to-app)가 그 끝나는 날로 앱을 덮었다.
--   이 함수가 그 이용권 · 출입권한을 앱이 정한 시작일로 옮긴다: 끝나는 날 = 시작일 + N개월 − 1일 (브로제이 · 앱과 같은 식).
--
--   · 부르는 곳: 앱 Edge Function payssam-callback(결제 직후) · payssam-sync-cancels(못 옮긴 주문 30분마다) — 서버 키(OS_SERVICE_KEY)만.
--   · 앱 결제 때 만든 그대로인 이용권만 옮긴다(활성 · 결제 · 홀딩 없음 · 끝나는 날 = 시작일 + N개월) — 데스크가 고쳤으면 'changed'.
--   · 같이 만든 출입권한(같은 기간 · 활성) 하나도 같은 날만큼 옮긴다 — app_refund_paid_membership 이 이용권과 같은 기간으로 찾기 때문.
--   · 두 번 불러도 한 번만 된다(이미 그 날이면 already) · 줄을 지우지 않는다.
--   · 시작일은 오늘 −14일 ~ +400일 안만 (오래된 주문을 잘못 옮기지 않게).
--   이용권 트리거: sync_membership_to_app_aiu(시작일 · 끝나는 날이 바뀌면 앱에 다시 알림) · 감사 기록. 상태는 그대로라 단말 작업은 없다.

create or replace function public.app_set_paid_membership_start(_ext_order_id text, _start date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _pr public.payment_requests;
  _ms public.memberships;
  _mon integer;
  _end date;
  _g uuid;
begin
  if coalesce(btrim(_ext_order_id), '') = '' then
    raise exception 'EXT_ORDER_ID_REQUIRED';
  end if;
  if _start is null or _start < current_date - 14 or _start > current_date + 400 then
    return jsonb_build_object('ok', false, 'reason', 'start_out_of_range');
  end if;

  select * into _pr from public.payment_requests where idempotency_key = 'payssam:' || _ext_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if _pr.status <> 'paid' or _pr.membership_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_paid');
  end if;

  select * into _ms from public.memberships where id = _pr.membership_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_membership');
  end if;

  _mon := greatest(1, coalesce(_pr.plan_months, 1));
  _end := (_start + make_interval(months => _mon))::date - 1;

  if _ms.start_date = _start and _ms.end_date = _end then
    return jsonb_build_object('ok', true, 'already', true, 'membership_id', _ms.id, 'start_date', _start, 'end_date', _end);
  end if;

  -- 앱 결제 때 만든 그대로일 때만 (데스크가 고친 이용권 · 홀딩 · 환불 · 지운 것은 건드리지 않는다)
  if _ms.status <> 'active' or _ms.payment_status <> 'paid' or _ms.deleted_at is not null
     or _ms.hold_start is not null or coalesce(_ms.total_held_days, 0) <> 0
     or _ms.end_date <> (_ms.start_date + make_interval(months => _mon))::date then
    return jsonb_build_object('ok', false, 'reason', 'changed', 'membership_id', _ms.id);
  end if;

  -- 같이 만든 출입권한 하나 (app_activate_paid_membership 이 같은 기간으로 만든 것 — 만든 시각이 가장 가까운 것)
  select g.id into _g
    from public.access_grants g
   where g.member_id = _ms.member_id
     and g.branch_id is not distinct from _ms.branch_id
     and g.grant_type = 'membership'
     and g.status = 'active'
     and g.valid_from::date = _ms.start_date
     and g.valid_until::date = _ms.end_date
   order by abs(extract(epoch from (g.created_at - _ms.created_at)))
   limit 1
   for update;
  if _g is not null then
    -- 시각은 그대로 두고 날만 옮긴다 (환불 함수가 valid_from::date = 이용권 시작일로 찾는다)
    update public.access_grants
       set valid_from = valid_from + make_interval(days => _start - _ms.start_date),
           valid_until = valid_until + make_interval(days => _end - _ms.end_date)
     where id = _g;
  end if;

  update public.memberships set start_date = _start, end_date = _end where id = _ms.id;

  return jsonb_build_object(
    'ok', true, 'membership_id', _ms.id, 'start_date', _start, 'end_date', _end, 'grant_moved', _g is not null
  );
end;
$function$;

revoke all on function public.app_set_paid_membership_start(text, date) from public, anon, authenticated;
grant execute on function public.app_set_paid_membership_start(text, date) to service_role;
