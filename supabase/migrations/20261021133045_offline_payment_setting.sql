-- 칠금점 수강권 — 계좌이체 · 현장 결제만 (2026-10-21 대표님: "칠금점 수강권은 따로 결제선생을 통해서 구축해야 돼.
--   그래서 일단 계좌이체와 오프라인 결제만 가능하게 하자")
--
--   앱은 칠금점 회원에게 결제선생 결제를 열지 않고 '계좌이체 · 현장 결제' 안내만 보여 준다 (src/lib/branchPayment.ts).
--   안내에 나올 계좌는 이 한 줄(app_settings 'offline_payment')에서 읽는다 — 셋 중 하나라도 비어 있으면 '계좌번호는 데스크에서 안내'.
--   계좌가 정해지면 bank · account · holder 만 채우면 된다 (앱을 다시 올릴 필요 없음).
--   이미 값이 있으면 건드리지 않는다.

insert into public.app_settings (key, value, updated_at)
values (
  'offline_payment',
  jsonb_build_object(
    '153복싱짐 칠금점', jsonb_build_object('bank', '', 'account', '', 'holder', ''),
    'note', '앱 결제(결제선생) 대신 계좌이체 · 현장 결제로 받는 지점의 계좌. 비어 있으면 데스크 안내. 2026-10-21 대표님: 칠금점'
  ),
  now()
)
on conflict (key) do nothing;
