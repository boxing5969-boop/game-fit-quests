-- 신규가입 화면이 "등록 가능한 수강권이 없습니다" 만 띄우던 원인 수정.
--
-- 배경: /signup-apply 는 아직 로그인하지 않은 사람이 보는 화면이다(anon 역할).
--       그런데 membership_products 의 조회 정책이 2026-06-22 생성 이래
--       'for select TO authenticated' 로만 걸려 있어서 비로그인 방문자에게는 0건이 나왔다.
--       상품이 0건이면 가입폼 4단계에서 더 나아갈 수 없으므로,
--       이 앱은 지금껏 단 한 명도 가입폼으로 가입시킨 적이 없다
--       (근거: profiles.signup_agreed_at 이 3,339명 전원 NULL).
--
-- 노출 범위: 판매 중인 상품의 이름·가격·기간뿐이다. 체육관 벽에 붙는 가격표와 같은 정보이고
--            원가·마진 같은 내부 수치는 이 테이블에 없다. 비활성 상품은 계속 감춰진다.
create policy "view active products anon"
  on public.membership_products
  for select
  to anon
  using (is_active = true);

comment on policy "view active products anon" on public.membership_products is
  '비로그인 신규가입 화면(/signup-apply)이 판매 중인 수강권을 보여주기 위한 최소 공개. 활성 상품만.';
