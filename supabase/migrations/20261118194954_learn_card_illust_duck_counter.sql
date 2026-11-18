-- 영상으로 배우기 — 「더킹 → 카운터」 카드 2컷 그림 (2026-11-18 · 2차)
--   1차(20261118135152_learn_card_illust)에서 첫 그림이 틀려 다시 그린 카드 한 장.
--   그림 = public/assets/learn-illust/1530c4d0-0008-4a00-8000-000000001114.webp (앱과 함께 배포)
--   · 지금 그림이 비었을 때만 넣는다(그사이 훈련 라이브러리에서 넣은 그림은 그대로)
--   · 줄을 지우는 문장 · 함수 · 표 변경 없음 · main 배포(그림 파일)가 끝난 뒤에 적용

update public.training_exercises
   set image_url = 'https://myboxer153.com/assets/learn-illust/1530c4d0-0008-4a00-8000-000000001114.webp'
 where id = '1530c4d0-0008-4a00-8000-000000001114'
   and (image_url is null or btrim(image_url) = '');
