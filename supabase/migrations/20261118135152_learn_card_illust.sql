-- 영상으로 배우기 — 동작마다 2컷 순서 그림 (2026-11-18)
--   대표님 「마이복서 153 영상으로 배우기탭에 이렇게 그림으로 2개 이미지로 설명해줘 모든 영상에 그런데 최상단에
--   영상이 먼저 나오고 설명글 바로위에 이미지가 나오게 해줘 모든 동작은 영상 밑에 이미지 소개글」
--   · 그림 = 「스트레이트(원투)」 카드의 2컷 그림(① ② · 민트 머리 복서 · 흰 바탕)과 같은 모양으로 새로 그린 28장
--     + 원투 카드는 「스트레이트(원투)」 그림을 같이 쓴다 → 회원용 영상이 있는 카드 24장이 모두 2컷 그림을 갖는다
--   · 파일은 앱과 함께 배포: public/assets/learn-illust/<카드 id>.webp (1200×896) — main 배포가 끝난 뒤에 적용한다
--   · 카드 시트(TrainingDrillSheet)는 영상 → 동작 그림 → 글 순서 · 영상이 없는 카드는 그림이 맨 위(예전 그대로)
--   · 지금 그림이 비었거나 예전 그림 그대로일 때만 바꾼다 — 그사이 대표님 · 운영진이 훈련 라이브러리에서 고친 그림은 그대로
--   · 줄을 지우는 문장 없음 · 함수 · 표 · 권한 변경 없음 (DB 어긋남 점검 대상 아님)
update public.training_exercises t
set image_url = v.new_url
from (values
  ('1530c4d0-001c-4a00-8000-000000001116'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-001c-4a00-8000-000000001116.webp', null::text),  -- 블로킹 · 커버
  ('1530c4d0-0019-4a00-8000-000000001116'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0019-4a00-8000-000000001116.webp', null::text),  -- 잽 · 스트레이트
  ('9e48a0d6-aafd-4fc9-805f-b1232c9db2de'::uuid, 'https://myboxer153.com/assets/learn-illust/9e48a0d6-aafd-4fc9-805f-b1232c9db2de.webp', null::text),  -- 사이드 스텝
  ('1530c4d0-0013-4a00-8000-000000001116'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0013-4a00-8000-000000001116.webp', null::text),  -- 기본 스텝
  ('f294e207-515d-4c01-898b-5d930ea8cb4e'::uuid, 'https://myboxer153.com/assets/learn-illust/f294e207-515d-4c01-898b-5d930ea8cb4e.webp', null::text),  -- 위빙
  ('b9e75f6c-33d0-43f2-b7d8-f071034d40cd'::uuid, 'https://myboxer153.com/assets/learn-illust/b9e75f6c-33d0-43f2-b7d8-f071034d40cd.webp', null::text),  -- 훅
  ('1530c4d0-0011-4a00-8000-000000001116'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0011-4a00-8000-000000001116.webp', null::text),  -- 더킹 · 위빙 자세
  ('1530c4d0-0001-4a00-8000-000000001112'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0001-4a00-8000-000000001112.webp', null::text),  -- 십자 스텝
  ('1530c4d0-0014-4a00-8000-000000001116'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0014-4a00-8000-000000001116.webp', null::text),  -- 왼손 훅 · 오른손 훅
  ('1530c4d0-0004-4a00-8000-000000001112'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0004-4a00-8000-000000001112.webp', null::text),  -- 샌드백 구령
  ('1530c4d0-0002-4a00-8000-000000001112'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0002-4a00-8000-000000001112.webp', null::text),  -- 뛰는 스텝
  ('1530c4d0-001b-4a00-8000-000000001116'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-001b-4a00-8000-000000001116.webp', null::text),  -- 원투 · 훅 콤비네이션
  ('1530c4d0-0016-4a00-8000-000000001116'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0016-4a00-8000-000000001116.webp', null::text),  -- 스트레이트 · 훅 콤비
  ('1530c4d0-0017-4a00-8000-000000001116'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0017-4a00-8000-000000001116.webp', null::text),  -- 훅 → 위빙
  ('1530c4d0-0012-4a00-8000-000000001116'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0012-4a00-8000-000000001116.webp', null::text),  -- 원투 · 훅 · 더킹
  ('2839e80e-223e-44da-a40a-8f4da690e450'::uuid, 'https://myboxer153.com/assets/learn-illust/2839e80e-223e-44da-a40a-8f4da690e450.webp', 'https://d8j0ntlcm91z4.cloudfront.net/user_37aEAtGHnQLnVTaBYv2HlGMudfD/hf_20260720_193831_0124c2b1-86ae-4a40-847e-fb73fcdcfbd5.png'::text),  -- 밴드 쉐도우 복싱
  ('bd363e59-053f-40a1-8042-e5a1d4affc3a'::uuid, 'https://myboxer153.com/assets/learn-illust/bd363e59-053f-40a1-8042-e5a1d4affc3a.webp', 'https://d8j0ntlcm91z4.cloudfront.net/user_37aEAtGHnQLnVTaBYv2HlGMudfD/hf_20260720_193834_62efcfd2-7d70-4d0c-9ceb-34db414c468a.jpeg'::text),  -- 아령 쉐도우 복싱
  ('c750e429-69ef-4042-bb7a-18e6230a7f0e'::uuid, 'https://myboxer153.com/assets/learn-illust/c750e429-69ef-4042-bb7a-18e6230a7f0e.webp', 'https://d8j0ntlcm91z4.cloudfront.net/user_37aEAtGHnQLnVTaBYv2HlGMudfD/hf_20260720_193836_61626fd8-f098-4240-89f4-b562cb6d0d0f.png'::text),  -- 아령 샌드백 터치
  ('c7048802-cb1a-4fdf-9f98-3ea730cc923a'::uuid, 'https://myboxer153.com/assets/learn-illust/c7048802-cb1a-4fdf-9f98-3ea730cc923a.webp', 'https://d8j0ntlcm91z4.cloudfront.net/user_37aEAtGHnQLnVTaBYv2HlGMudfD/hf_20260721_000206_1f95f3d3-9945-4fb1-b92d-1b1d8d4a8778.png'::text),  -- 위빙-훅 연결
  ('69bb84c3-0176-4114-902b-8ca8fee15e3b'::uuid, 'https://myboxer153.com/assets/learn-illust/69bb84c3-0176-4114-902b-8ca8fee15e3b.webp', 'https://d8j0ntlcm91z4.cloudfront.net/user_37aEAtGHnQLnVTaBYv2HlGMudfD/hf_20260721_000141_78b3ad60-e173-4f01-b0c6-83c0c3c70f9c.png'::text),  -- 위빙 연결 콤비
  ('1530c4d0-0018-4a00-8000-000000001116'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0018-4a00-8000-000000001116.webp', null::text),  -- 기본 스탠스
  ('1530c4d0-0015-4a00-8000-000000001116'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0015-4a00-8000-000000001116.webp', null::text),  -- 기본 가드 자세
  ('2d305d98-107b-4a6a-a1cd-43c7f7fd7598'::uuid, 'https://myboxer153.com/assets/learn-illust/2d305d98-107b-4a6a-a1cd-43c7f7fd7598.webp', null::text),  -- 제자리 스텝
  ('b7480eaf-ef48-4abe-be2b-1e0e8d5daa22'::uuid, 'https://myboxer153.com/assets/learn-illust/b7480eaf-ef48-4abe-be2b-1e0e8d5daa22.webp', null::text),  -- 패리·블로킹
  ('1530c4d0-0003-4a00-8000-000000001112'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0003-4a00-8000-000000001112.webp', null::text),  -- 워킹 런지
  ('1530c4d0-0005-4a00-8000-000000001114'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0005-4a00-8000-000000001114.webp', null::text),  -- 인앤아웃 잽 → 카운터
  ('1530c4d0-0006-4a00-8000-000000001114'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0006-4a00-8000-000000001114.webp', null::text),  -- 원투 → 리드 피벗
  ('1530c4d0-0007-4a00-8000-000000001114'::uuid, 'https://myboxer153.com/assets/learn-illust/1530c4d0-0007-4a00-8000-000000001114.webp', null::text),  -- 원투쓱빡
  ('1530c4d0-001a-4a00-8000-000000001116'::uuid, 'https://d8j0ntlcm91z4.cloudfront.net/user_37aEAtGHnQLnVTaBYv2HlGMudfD/hf_20260721_151931_7b348938-825d-4f90-ae95-43f8a654119a.png', null::text)  -- 원투 (「스트레이트(원투)」 그림을 같이 씀)
) as v(id, new_url, old_url)
where t.id = v.id
  and (coalesce(t.image_url, '') = '' or t.image_url = v.old_url);
