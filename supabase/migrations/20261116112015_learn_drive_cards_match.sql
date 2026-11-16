-- 영상으로 배우기 — 드라이브 동작 영상과 카드 글 맞추기 (2026-11-16)
--   대표님 「영상으로 배우기 탭에는 다른동작에 설명이 나와」
--   20261116102134_learn_drive_videos 에서 같은 동작이라고 붙인 영상 8편 중 5편은 영상 제목 · 자막 · 목소리와 카드 이름 · 글이 달랐다
--   (영상 「잽 · 스트레이트」 ↔ 카드 「잽」 · 「기본 스탠스」 ↔ 「거울 스탠스 체크」 · 「원투」 ↔ 「스트레이트(원투)」 ·
--    「원투 · 훅 콤비네이션」 ↔ 「원투쓰리 콤비 (1-2-3)」(블루 레벨 12) · 「블로킹 · 커버」 ↔ 「패리·블로킹」).
--   ① 그 영상마다 영상과 같은 이름 · 글의 카드를 새로 만든다(5장 · 고정 id 1530c4d0-001{8,9,a,b,c}-…-1116 · 이름이 같은 카드가 있으면 안 넣음)
--      글은 드라이브 「동작별_목록_v3」 코칭 포인트 = 영상 자막 · 목소리 그대로(포인트 3줄) ·
--      예시 카드 lib/trainingCardsSample NEW_CARDS_1116_MATCH 와 한 글자씩 같다(시험)
--   ② 예전 카드 5장은 영상을 뗀다 — 칸 값이 드라이브 영상 그대로일 때만(그사이 대표님이 바꾼 영상은 그대로) · 카드 글은 그대로
--   · 훅 · 어퍼컷 · 슬립은 영상과 카드 글이 같은 동작이라 그대로 둔다. 영상 파일(저장소)은 그대로 — 새 카드가 같은 파일을 쓴다.
--   · 기존 함수 · 표 · 권한은 그대로. 되돌리기는 맨 아래.

-- ① 영상과 같은 카드 5장
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-0018-4a00-8000-000000001116'::uuid, '기본 스탠스', '기본기', 1, 0, '초급', '하체 · 기본 자세',
       '발은 어깨너비, 체중은 양발에 반반으로 서는 기본 자세',
       '복싱의 모든 동작은 스탠스에서 시작해요. 발은 어깨너비로 벌리고 앞발은 상대를 향해요. 뒤꿈치는 살짝 띄우고 무릎은 부드럽게 굽혀, 체중을 양발에 반반 나눠 실어요. 이렇게 서면 앞뒤 어디로든 바로 움직일 수 있어요.',
       '', '["발은 어깨너비, 앞발은 상대를 향해요", "뒤꿈치는 살짝 띄우고 무릎은 부드럽게", "체중은 양발에 반반"]'::jsonb,
       '["두 발이 한 줄에 서서 몸이 흔들려요 → 발을 어깨너비로 벌려 옆으로도 간격을 둬요", "체중이 한쪽 발에 쏠려요 → 양발에 반반씩 실어요"]'::jsonb,
       3, true, 'member/c1062d07-e8eb-42f9-8aba-c2261e0196ed-d4ecynob1.mp4', 'member/poster-c1062d07-e8eb-42f9-8aba-c2261e0196ed-d4ecynob1.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-0018-4a00-8000-000000001116'::uuid or t.name = '기본 스탠스');
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-0019-4a00-8000-000000001116'::uuid, '잽 · 스트레이트', '기본기', 1, 1, '초급', '팔 · 직선 펀치',
       '앞손 잽은 곧게, 뒷손 스트레이트는 뒷발 회전으로',
       '잽은 앞손을 곧게 뻗는 펀치, 스트레이트는 뒷발을 돌려 뒷손을 뻗는 펀치예요. 잽을 칠 때는 턱을 당기고, 스트레이트는 뒷발 회전으로 허리를 돌려 쳐요. 두 펀치 모두 치고 나면 나간 길 그대로 가드로 돌아와요.',
       '', '["잽은 앞손으로 곧게, 턱은 당겨요", "스트레이트는 뒷발 회전으로", "치고 나면 같은 길로 가드 복귀"]'::jsonb,
       '["주먹이 옆으로 돌아 나가요 → 턱 앞에서 곧게 뻗어요", "스트레이트를 팔로만 쳐요 → 뒷발 뒤꿈치를 돌려 허리와 함께 뻗어요"]'::jsonb,
       5, true, 'member/9fec2574-5132-4d6d-bdc7-09c6c635e5fe-djcgxueut.mp4', 'member/poster-9fec2574-5132-4d6d-bdc7-09c6c635e5fe-djcgxueut.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-0019-4a00-8000-000000001116'::uuid or t.name = '잽 · 스트레이트');
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-001a-4a00-8000-000000001116'::uuid, '원투', '기본기', 1, 2, '초급', '팔 · 콤비',
       '잽으로 거리를 잡고 스트레이트로 마무리하는 두 번 공격',
       '잽(원)으로 거리를 잡고, 스트레이트(투)로 마무리하는 복싱의 첫 콤비네이션이에요. 스트레이트는 뒷발 회전으로 허리를 돌려 쳐요. 하나, 둘 — 두 펀치 사이 리듬이 끊기지 않게 이어 쳐요.',
       '', '["잽으로 거리, 스트레이트로 마무리", "뒷발 회전으로 허리를 돌려요", "하나-둘, 리듬을 끊지 않아요"]'::jsonb,
       '["잽과 스트레이트 사이에 멈춰요 → 하나 · 둘 리듬으로 이어서 쳐요", "스트레이트에서 뒷발이 바닥에 붙어 있어요 → 뒷발 뒤꿈치를 돌려 허리를 돌려요"]'::jsonb,
       5, true, 'member/e2470ff0-13d6-4993-b5b6-967b9bfa26f6-dukps3u7t.mp4', 'member/poster-e2470ff0-13d6-4993-b5b6-967b9bfa26f6-dukps3u7t.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-001a-4a00-8000-000000001116'::uuid or t.name = '원투');
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-001b-4a00-8000-000000001116'::uuid, '원투 · 훅 콤비네이션', '콤비네이션', 8, 93, '초급', '콤비 · 몸통 회전',
       '원투로 열고 훅으로 마무리하는 세 번 공격',
       '원투로 상대를 열고, 몸통을 돌려 훅으로 마무리하는 콤비네이션이에요. 훅은 팔이 아니라 몸통 회전으로 쳐요. 마지막 훅을 친 뒤에는 바로 가드로 돌아와요.',
       '', '["원투로 열고, 훅으로 마무리", "훅은 팔이 아니라 몸통 회전으로", "마지막 훅 뒤에 가드 복귀"]'::jsonb,
       '["훅을 팔로만 크게 휘둘러요 → 발끝과 허리를 먼저 돌려요", "훅을 치고 손이 내려가요 → 치자마자 가드로 돌아와요"]'::jsonb,
       5, true, 'member/b6cbf20a-c3ce-475c-b230-38d73e44367a-dqa0gwh6z.mp4', 'member/poster-b6cbf20a-c3ce-475c-b230-38d73e44367a-dqa0gwh6z.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-001b-4a00-8000-000000001116'::uuid or t.name = '원투 · 훅 콤비네이션');
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-001c-4a00-8000-000000001116'::uuid, '블로킹 · 커버', '방어', 1, 0, '초급', '방어 · 가드',
       '팔꿈치를 붙이고 손은 관자놀이에 — 막고 바로 반격',
       '상대 펀치를 팔과 글러브로 막는 기본 방어예요. 팔꿈치를 몸에 붙이고 손은 관자놀이에 대요. 막는 동안에도 눈은 상대를 보고, 막자마자 바로 반격해요.',
       '', '["팔꿈치 붙이고 손은 관자놀이에", "막을 때도 시선은 상대에게", "막자마자 바로 반격"]'::jsonb,
       '["막을 때 눈을 감거나 고개를 돌려요 → 시선은 끝까지 상대에게", "막고 나서 그대로 웅크려요 → 막자마자 바로 반격해요"]'::jsonb,
       3, true, 'member/b7480eaf-ef48-4abe-be2b-1e0e8d5daa22-debznj7c9.mp4', 'member/poster-b7480eaf-ef48-4abe-be2b-1e0e8d5daa22-debznj7c9.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-001c-4a00-8000-000000001116'::uuid or t.name = '블로킹 · 커버');

-- ② 예전 카드 5장에서 드라이브 영상 떼기 (칸 값이 드라이브 영상 그대로일 때만 · 카드 글은 그대로)
update public.training_exercises set video_path = null,
       poster_path = case when poster_path = 'member/poster-c1062d07-e8eb-42f9-8aba-c2261e0196ed-d4ecynob1.webp' then null else poster_path end
 where id = 'c1062d07-e8eb-42f9-8aba-c2261e0196ed'::uuid and video_path = 'member/c1062d07-e8eb-42f9-8aba-c2261e0196ed-d4ecynob1.mp4'
   and exists (select 1 from public.training_exercises n where n.id = '1530c4d0-0018-4a00-8000-000000001116'::uuid and n.video_path = 'member/c1062d07-e8eb-42f9-8aba-c2261e0196ed-d4ecynob1.mp4');
update public.training_exercises set video_path = null,
       poster_path = case when poster_path = 'member/poster-9fec2574-5132-4d6d-bdc7-09c6c635e5fe-djcgxueut.webp' then null else poster_path end
 where id = '9fec2574-5132-4d6d-bdc7-09c6c635e5fe'::uuid and video_path = 'member/9fec2574-5132-4d6d-bdc7-09c6c635e5fe-djcgxueut.mp4'
   and exists (select 1 from public.training_exercises n where n.id = '1530c4d0-0019-4a00-8000-000000001116'::uuid and n.video_path = 'member/9fec2574-5132-4d6d-bdc7-09c6c635e5fe-djcgxueut.mp4');
update public.training_exercises set video_path = null,
       poster_path = case when poster_path = 'member/poster-e2470ff0-13d6-4993-b5b6-967b9bfa26f6-dukps3u7t.webp' then null else poster_path end
 where id = 'e2470ff0-13d6-4993-b5b6-967b9bfa26f6'::uuid and video_path = 'member/e2470ff0-13d6-4993-b5b6-967b9bfa26f6-dukps3u7t.mp4'
   and exists (select 1 from public.training_exercises n where n.id = '1530c4d0-001a-4a00-8000-000000001116'::uuid and n.video_path = 'member/e2470ff0-13d6-4993-b5b6-967b9bfa26f6-dukps3u7t.mp4');
update public.training_exercises set video_path = null,
       poster_path = case when poster_path = 'member/poster-b6cbf20a-c3ce-475c-b230-38d73e44367a-dqa0gwh6z.webp' then null else poster_path end
 where id = 'b6cbf20a-c3ce-475c-b230-38d73e44367a'::uuid and video_path = 'member/b6cbf20a-c3ce-475c-b230-38d73e44367a-dqa0gwh6z.mp4'
   and exists (select 1 from public.training_exercises n where n.id = '1530c4d0-001b-4a00-8000-000000001116'::uuid and n.video_path = 'member/b6cbf20a-c3ce-475c-b230-38d73e44367a-dqa0gwh6z.mp4');
update public.training_exercises set video_path = null,
       poster_path = case when poster_path = 'member/poster-b7480eaf-ef48-4abe-be2b-1e0e8d5daa22-debznj7c9.webp' then null else poster_path end
 where id = 'b7480eaf-ef48-4abe-be2b-1e0e8d5daa22'::uuid and video_path = 'member/b7480eaf-ef48-4abe-be2b-1e0e8d5daa22-debznj7c9.mp4'
   and exists (select 1 from public.training_exercises n where n.id = '1530c4d0-001c-4a00-8000-000000001116'::uuid and n.video_path = 'member/b7480eaf-ef48-4abe-be2b-1e0e8d5daa22-debznj7c9.mp4');

-- 되돌리기 (대표님 확인 뒤에만)
-- update public.training_exercises o set video_path = n.video_path, poster_path = coalesce(o.poster_path, n.poster_path)
--   from public.training_exercises n
--  where o.video_path is null and n.id::text like '1530c4d0-001_-4a00-8000-000000001116' and n.video_path like 'member/' || o.id::text || '-d%';
-- update public.training_exercises set is_active = false where id::text in ('1530c4d0-0018-4a00-8000-000000001116', '1530c4d0-0019-4a00-8000-000000001116',
--   '1530c4d0-001a-4a00-8000-000000001116', '1530c4d0-001b-4a00-8000-000000001116', '1530c4d0-001c-4a00-8000-000000001116');
