-- 영상으로 배우기 — 블루 타이틀 콤보 세 덩어리 카드 (2026-11-23 대표님
--   「내 원본 영상 중에 잽 원투 원투훅 더킹 위빙 등등 타이틀미션 20 영상 하나로 편집해서 다양한 동작들을 회원님들에게 컨텐츠로 제공」)
--   레벨 20 블루 타이틀 미션 18동작(src/lib/titleMissionGuide.ts 의 ① ② ③ 묶음)을 대표님 원본 영상(정면 · 옆)에서 잘라
--   덩어리마다 회원용 영상(1080×1350 · 옆에서 · 천천히 0.5배 · 정면 · 자막 · 인준 목소리) 하나씩 만들었다.
--   · 새 카드 3장 · 고정 id 1530c4d0-002{1,2,3}-4a00-8000-000000001123 · 이름이 같은 카드가 있으면 안 넣는다
--   · 영상 · 첫 장면은 이미 비공개 저장소 training-videos member/ 에 올라가 있다(card-video-intake · 11/23)
--   · 글은 타이틀 미션 안내(titleMissionGuide) · 영상 자막과 같은 말 · 예시 카드 lib/trainingCardsSample NEW_CARDS_1123 과
--     한 글자씩 같다(시험)
--   · 18동작 전체(블루 마스터 리허설 라운드) · 더킹 → 훅 카운터 → 훅(디펜스-카운터 체인)은 새 카드가 아니라
--     training_video_candidates 「새 영상」으로 올려 두었다(대표님이 카드 시트에서 「이대로 붙이기」).
--   · 기존 함수 · 표 · 권한은 그대로 · 줄을 지우는 문장 없음. 되돌리기는 맨 아래.

insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-0021-4a00-8000-000000001123'::uuid, '블루 타이틀 콤보 ① 때리고 피하기', '콤비네이션', 18, 265, '중급', '콤비 · 머리 움직임',
       '원투 훅을 치고 더킹 · 위빙으로 피하는 블루 타이틀 콤보 앞 8동작',
       '레벨 20 블루 타이틀 미션 18동작 중 첫 덩어리예요. 원투 → 훅 → 왼쪽 더킹 → 훅 → 더킹 → 훅 → 더킹 → 오른쪽 위빙 순서로 이어요. 더킹은 허리를 숙이지 않고 무릎을 굽혀 앉듯이 내려갔다 올라와요. 내려갈 때도 두 주먹은 턱 옆에 붙여 둬요.',
       '', '["원투 훅, 왼쪽 더킹 훅", "더킹은 허리 말고 무릎으로", "내려갈 때도 두 주먹은 턱 옆에"]'::jsonb,
       '["더킹할 때 허리부터 숙여요 → 무릎을 굽혀 앉듯이 내려가요", "피할 때 손이 내려가요 → 두 주먹은 턱 옆에 붙여 둬요"]'::jsonb,
       5, true, 'member/1530c4d0-0021-4a00-8000-000000001123-rv9lgdgf0.mp4', 'member/poster-1530c4d0-0021-4a00-8000-000000001123-rv9lgdgf0.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-0021-4a00-8000-000000001123'::uuid or t.name = '블루 타이틀 콤보 ① 때리고 피하기');
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-0022-4a00-8000-000000001123'::uuid, '블루 타이틀 콤보 ② 크로스부터 카운터', '콤비네이션', 19, 266, '중급', '콤비 · 카운터',
       '크로스 · 훅 · 레프트 훅을 치고 더킹으로 피한 뒤 훅으로 받아치는 6동작',
       '블루 타이틀 미션 18동작의 두 번째 덩어리예요. 크로스 → 훅 → 레프트 훅 → 왼쪽 더킹 → 훅 카운터 → 훅 순서로 이어요. 크로스는 뒷발 뒤꿈치를 바깥으로 돌리며 쳐요. 더킹으로 내려갔다 올라오는 힘을 그대로 훅 카운터에 실어요.',
       '', '["크로스, 훅, 레프트 훅", "왼쪽 더킹, 훅 카운터, 훅", "피하고 바로 쳐요"]'::jsonb,
       '["더킹과 훅 사이에 멈춰요 → 올라오는 힘으로 바로 훅을 쳐요", "훅을 팔로만 휘둘러요 → 치는 손 쪽 발 뒤꿈치를 돌려 허리로 쳐요"]'::jsonb,
       5, true, 'member/1530c4d0-0022-4a00-8000-000000001123-rbztb7kk4.mp4', 'member/poster-1530c4d0-0022-4a00-8000-000000001123-rbztb7kk4.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-0022-4a00-8000-000000001123'::uuid or t.name = '블루 타이틀 콤보 ② 크로스부터 카운터');
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-0023-4a00-8000-000000001123'::uuid, '블루 타이틀 콤보 ③ 어퍼로 마무리', '콤비네이션', 20, 267, '중급', '콤비 · 어퍼컷',
       '옆 어퍼로 올려 치고 더킹 뒤 훅 카운터 · 훅으로 끝내는 마지막 4동작',
       '블루 타이틀 미션 18동작의 마지막 덩어리예요. 옆 어퍼 → 더킹 → 훅 카운터 → 훅 순서로 이어요. 옆 어퍼는 무릎을 살짝 굽혔다 펴는 힘과 허리 회전으로 아래에서 위로 올려 쳐요. 마지막 훅을 친 손은 바로 턱 옆으로 돌아와요.',
       '', '["옆 어퍼, 더킹", "훅 카운터, 훅", "어퍼는 무릎을 폈다 올리는 힘으로"]'::jsonb,
       '["어퍼를 팔만 들어 올려 쳐요 → 무릎을 폈다 올리는 힘으로 쳐요", "마지막 훅 뒤에 팔이 벌어져요 → 친 손은 바로 턱 옆으로 돌아와요"]'::jsonb,
       5, true, 'member/1530c4d0-0023-4a00-8000-000000001123-rzhh2p81z.mp4', 'member/poster-1530c4d0-0023-4a00-8000-000000001123-rzhh2p81z.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-0023-4a00-8000-000000001123'::uuid or t.name = '블루 타이틀 콤보 ③ 어퍼로 마무리');

-- 되돌리기 (대표님 확인 뒤에만 — 지우지 않고 숨김)
-- update public.training_exercises set is_active = false where id::text like '1530c4d0-002_-4a00-8000-000000001123';
