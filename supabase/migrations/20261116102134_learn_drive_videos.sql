-- 영상으로 배우기 — 구글 드라이브 「153복싱짐 앱 복싱동작 · 편집본 v3 동작별」 영상 15편을 카드에 (2026-11-16)
--   대표님 「영상으로 배우기 탭에 … 구글 드라이브에 있는 복싱 기본기 · 기술 등등 영상 모두 볼 수 있게 · 자연스러운 더빙 기본값으로」
--   · 영상(1920×1080 · 목소리 더빙 인준 + 배경음악)과 첫 장면은 비공개 저장소 training-videos 의 member/ 에 먼저 올려 둔다
--     (Edge Function card-video-intake · 일회 열쇠). 이 파일은 카드 칸에 경로만 적는다.
--   ① 같은 동작 카드가 있으면 그 카드의 회원용 영상 칸에 — 비어 있을 때만(대표님이 그사이 넣은 영상은 그대로) · 8장
--      거울 스탠스 체크(기본 스탠스) · 잽(잽 · 스트레이트) · 훅 · 스트레이트(원투)(원투) · 원투쓰리 콤비(원투 · 훅 콤비네이션) ·
--      패리·블로킹(블로킹 · 커버) · 어퍼컷 · 슬립
--   ② 같은 동작 카드가 없으면 새 카드 7장(고정 id 1530c4d0-001n-…-1116 · 이름이 같은 카드가 있으면 안 넣음) —
--      글은 드라이브 「동작별_목록_v3」 코칭 포인트 그대로(포인트 3줄) · 예시 카드 lib/trainingCardsSample NEW_CARDS_1116 과 한 글자씩 같다(시험)
--   · 기존 함수 · 표 · 권한은 그대로. 되돌리기는 맨 아래.

-- ① 같은 동작 카드에 영상 붙이기 (회원용 영상이 비어 있을 때만)
update public.training_exercises set video_path = 'member/c1062d07-e8eb-42f9-8aba-c2261e0196ed-d4ecynob1.mp4', poster_path = coalesce(poster_path, 'member/poster-c1062d07-e8eb-42f9-8aba-c2261e0196ed-d4ecynob1.webp')
 where id = 'c1062d07-e8eb-42f9-8aba-c2261e0196ed'::uuid and video_path is null;
update public.training_exercises set video_path = 'member/9fec2574-5132-4d6d-bdc7-09c6c635e5fe-djcgxueut.mp4', poster_path = coalesce(poster_path, 'member/poster-9fec2574-5132-4d6d-bdc7-09c6c635e5fe-djcgxueut.webp')
 where id = '9fec2574-5132-4d6d-bdc7-09c6c635e5fe'::uuid and video_path is null;
update public.training_exercises set video_path = 'member/b9e75f6c-33d0-43f2-b7d8-f071034d40cd-dghwymnyz.mp4', poster_path = coalesce(poster_path, 'member/poster-b9e75f6c-33d0-43f2-b7d8-f071034d40cd-dghwymnyz.webp')
 where id = 'b9e75f6c-33d0-43f2-b7d8-f071034d40cd'::uuid and video_path is null;
update public.training_exercises set video_path = 'member/e2470ff0-13d6-4993-b5b6-967b9bfa26f6-dukps3u7t.mp4', poster_path = coalesce(poster_path, 'member/poster-e2470ff0-13d6-4993-b5b6-967b9bfa26f6-dukps3u7t.webp')
 where id = 'e2470ff0-13d6-4993-b5b6-967b9bfa26f6'::uuid and video_path is null;
update public.training_exercises set video_path = 'member/b6cbf20a-c3ce-475c-b230-38d73e44367a-dqa0gwh6z.mp4', poster_path = coalesce(poster_path, 'member/poster-b6cbf20a-c3ce-475c-b230-38d73e44367a-dqa0gwh6z.webp')
 where id = 'b6cbf20a-c3ce-475c-b230-38d73e44367a'::uuid and video_path is null;
update public.training_exercises set video_path = 'member/b7480eaf-ef48-4abe-be2b-1e0e8d5daa22-debznj7c9.mp4', poster_path = coalesce(poster_path, 'member/poster-b7480eaf-ef48-4abe-be2b-1e0e8d5daa22-debznj7c9.webp')
 where id = 'b7480eaf-ef48-4abe-be2b-1e0e8d5daa22'::uuid and video_path is null;
update public.training_exercises set video_path = 'member/2350d855-4280-4b02-a4b5-76c7120e603f-d14jwouhm.mp4', poster_path = coalesce(poster_path, 'member/poster-2350d855-4280-4b02-a4b5-76c7120e603f-d14jwouhm.webp')
 where id = '2350d855-4280-4b02-a4b5-76c7120e603f'::uuid and video_path is null;
update public.training_exercises set video_path = 'member/3b4eb590-9ed6-410b-9098-0f73ee72c47c-d7kya8kq4.mp4', poster_path = coalesce(poster_path, 'member/poster-3b4eb590-9ed6-410b-9098-0f73ee72c47c-d7kya8kq4.webp')
 where id = '3b4eb590-9ed6-410b-9098-0f73ee72c47c'::uuid and video_path is null;

-- ② 새 카드 7장
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-0011-4a00-8000-000000001116'::uuid, '더킹 · 위빙 자세', '방어', 2, 4, '초급', '무릎 · 피하기 자세',
       '무릎을 굽혀 내려가고 U자로 넘어가는 피하기 자세 연습',
       '상대 펀치 아래로 내려가는 더킹과, 그대로 U자로 넘어가는 위빙의 기본 자세를 천천히 익혀요. 허리를 숙이지 않고 무릎을 굽혀 내려가고, 가드는 턱에 붙인 채 옆으로 넘어가요. 속도보다 정확한 자세가 먼저예요.',
       '', '["무릎을 굽혀 내려가고, 허리는 세워요", "가드는 턱에 붙인 채 U자로 넘어가요", "천천히 정확하게 — 속도는 나중에"]'::jsonb,
       '["허리만 숙여 머리가 앞으로 떨어져요 → 무릎을 굽혀 몸 전체가 내려가요", "넘어갈 때 가드가 내려가요 → 주먹을 턱에 붙인 채 움직여요"]'::jsonb,
       5, true, 'member/1530c4d0-0011-4a00-8000-000000001116-dll6vfnb7.mp4', 'member/poster-1530c4d0-0011-4a00-8000-000000001116-dll6vfnb7.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-0011-4a00-8000-000000001116'::uuid or t.name = '더킹 · 위빙 자세');
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-0012-4a00-8000-000000001116'::uuid, '원투 · 훅 · 더킹', '콤비네이션', 9, 95, '초급', '콤비 · 공격 뒤 피하기',
       '원투 · 훅을 치고 바로 무릎으로 내려가 피해요',
       '원투를 곧게 뻗고, 몸통을 돌려 훅을 친 뒤 바로 무릎을 굽혀 더킹으로 내려가요. 공격 뒤에 피하는 것까지가 한 묶음이에요. 더킹에서 올라오면 가드부터 세우고 다음 동작으로 이어 가요.',
       '', '["원투는 곧게, 훅은 몸통 회전으로", "훅 뒤에 바로 무릎으로 내려가요", "더킹 뒤엔 가드부터 세우고 다음 동작"]'::jsonb,
       '["훅을 치고 그 자리에 서 있어요 → 훅이 끝나는 순간 바로 무릎을 굽혀요", "더킹하며 허리를 숙여요 → 허리는 세우고 무릎으로 내려가요"]'::jsonb,
       5, true, 'member/1530c4d0-0012-4a00-8000-000000001116-du7cdlcjb.mp4', 'member/poster-1530c4d0-0012-4a00-8000-000000001116-du7cdlcjb.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-0012-4a00-8000-000000001116'::uuid or t.name = '원투 · 훅 · 더킹');
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-0013-4a00-8000-000000001116'::uuid, '기본 스텝', '풋워크', 1, 7, '초급', '발 · 이동',
       '앞발이 먼저 나가고 뒷발이 따라오는 기본 이동',
       '복싱 이동의 기본이에요. 앞으로 갈 땐 앞발이 먼저, 뒷발이 같은 만큼 따라와요. 두 발이 서로 엇갈리지 않게 간격을 지키고, 움직이는 동안에도 가드는 턱에 붙여요.',
       '', '["앞으로 갈 땐 앞발 먼저, 뒷발이 따라가요", "두 발이 엇갈리지 않게 간격을 지켜요", "스텝 중에도 가드는 턱에"]'::jsonb,
       '["두 발이 엇갈려 꼬여요 → 앞발이 가면 뒷발은 그만큼만 따라와요", "발에 집중하다 가드가 내려가요 → 주먹은 턱에 붙인 채 움직여요"]'::jsonb,
       5, true, 'member/1530c4d0-0013-4a00-8000-000000001116-dltre4lfv.mp4', 'member/poster-1530c4d0-0013-4a00-8000-000000001116-dltre4lfv.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-0013-4a00-8000-000000001116'::uuid or t.name = '기본 스텝');
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-0014-4a00-8000-000000001116'::uuid, '왼손 훅 · 오른손 훅', '기본기', 2, 5, '초급', '팔 · 몸통 회전',
       '발끝 회전으로 왼손 · 오른손 훅을 하나씩 익혀요',
       '왼손 훅과 오른손 훅을 하나씩 익혀요. 발끝을 먼저 돌리고 주먹은 그 회전을 따라가요. 팔꿈치는 주먹과 같은 높이로 들고, 치지 않는 손은 끝까지 뺨에 붙여 얼굴을 지켜요.',
       '', '["팔꿈치 높이는 주먹 높이와 같게", "발끝 회전이 먼저, 주먹은 따라가요", "반대손은 끝까지 뺨에"]'::jsonb,
       '["팔만 휘둘러요 → 발끝과 허리를 먼저 돌려요", "치는 동안 반대손이 내려가요 → 반대손은 뺨에 붙여 두어요"]'::jsonb,
       5, true, 'member/1530c4d0-0014-4a00-8000-000000001116-dmiss9nhw.mp4', 'member/poster-1530c4d0-0014-4a00-8000-000000001116-dmiss9nhw.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-0014-4a00-8000-000000001116'::uuid or t.name = '왼손 훅 · 오른손 훅');
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-0015-4a00-8000-000000001116'::uuid, '기본 가드 자세', '기본기', 1, 0, '초급', '전신 · 가드',
       '양손은 뺨에, 팔꿈치로 갈비뼈를 가리는 기본 자세',
       '모든 동작은 가드에서 시작해서 가드로 돌아와요. 양손을 뺨에 붙이고 팔꿈치로 갈비뼈를 가려요. 턱은 살짝 당기고 눈은 정면을 보며, 무릎을 살짝 굽혀 언제든 움직일 수 있게 서요.',
       '', '["양손은 뺨에, 팔꿈치는 갈비뼈를 가려요", "턱은 당기고 시선은 정면", "무릎은 살짝 굽혀 언제든 움직일 수 있게"]'::jsonb,
       '["주먹이 턱 아래로 내려가요 → 주먹을 뺨 높이에 붙여요", "팔꿈치가 벌어져 몸통이 보여요 → 팔꿈치를 갈비뼈에 붙여요"]'::jsonb,
       3, true, 'member/1530c4d0-0015-4a00-8000-000000001116-d0jtz9tec.mp4', 'member/poster-1530c4d0-0015-4a00-8000-000000001116-d0jtz9tec.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-0015-4a00-8000-000000001116'::uuid or t.name = '기본 가드 자세');
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-0016-4a00-8000-000000001116'::uuid, '스트레이트 · 훅 콤비', '콤비네이션', 8, 93, '초급', '콤비 · 체중 이동',
       '스트레이트로 열고 훅으로 닫는 두 번 공격',
       '스트레이트를 곧게 뻗고, 체중을 뒷발에서 앞발로 옮기며 훅으로 이어요. 스트레이트로 열고 훅으로 닫는 리듬이에요. 마지막 훅을 친 뒤에는 바로 가드로 돌아와요.',
       '', '["스트레이트로 열고 훅으로 닫아요", "체중은 뒷발에서 앞발로 옮겨요", "마지막 훅 뒤에 가드로 돌아와요"]'::jsonb,
       '["스트레이트와 훅 사이가 끊겨요 → 하나 · 둘 리듬으로 이어서 쳐요", "훅을 치고 손이 내려가요 → 치자마자 가드로 돌아와요"]'::jsonb,
       5, true, 'member/1530c4d0-0016-4a00-8000-000000001116-d1lz34bqf.mp4', 'member/poster-1530c4d0-0016-4a00-8000-000000001116-d1lz34bqf.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-0016-4a00-8000-000000001116'::uuid or t.name = '스트레이트 · 훅 콤비');
insert into public.training_exercises (id, name, category, level_min, sort_order, difficulty, target, summary, description, benefits, cues, mistakes, minutes, is_active, video_path, poster_path)
select '1530c4d0-0017-4a00-8000-000000001116'::uuid, '훅 → 위빙', '방어', 9, 5, '초급', '공격 뒤 피하기',
       '훅을 치고 U자로 빠져나와 다음 펀치를 준비해요',
       '훅을 친 뒤 그 자리에 머물지 않고, 무릎을 굽혀 U자로 빠져나와요. 위빙은 허리가 아니라 무릎으로 해요. 빠져나오면서 바로 다음 펀치를 칠 준비를 해요.',
       '', '["훅 뒤에 U자로 빠져요", "위빙은 무릎으로 — 허리로 하지 않아요", "빠져나오며 다음 펀치 준비"]'::jsonb,
       '["훅을 치고 멈춰 서요 → 훅이 끝나면 바로 무릎을 굽혀 빠져요", "허리를 숙여 머리만 내려가요 → 허리는 세우고 무릎으로 내려가요"]'::jsonb,
       5, true, 'member/1530c4d0-0017-4a00-8000-000000001116-d4l97bpfw.mp4', 'member/poster-1530c4d0-0017-4a00-8000-000000001116-d4l97bpfw.webp'
where not exists (select 1 from public.training_exercises t where t.id = '1530c4d0-0017-4a00-8000-000000001116'::uuid or t.name = '훅 → 위빙');

-- 되돌리기 (대표님 확인 뒤에만)
-- update public.training_exercises set video_path = null, poster_path = null where video_path like 'member/%-d________.mp4' and id::text not like '1530c4d0-001_-4a00-8000-000000001116';
-- update public.training_exercises set is_active = false where id::text like '1530c4d0-001_-4a00-8000-000000001116';
