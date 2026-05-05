-- ============================================================
-- 153 스토리 RPG 대사 풍부화 v2 (43A단계)
-- ============================================================
-- 18 챕터 × 5~7 dialogue (intro/progress/complete/reward/boss + NPC)
-- = 약 120 신규 dialogue.
-- 기존 intro 18개는 enhanced 본문으로 UPDATE.
-- 신규 type/sort_order 는 NOT EXISTS 가드로 INSERT (재실행 안전).
--
-- 보호 원칙:
--   · levels / missions / member_progress 미수정.
--   · 새 RPC / 기존 테이블 schema 변경 X.
--   · ChatAssistant / chat-assistant 호출 X (정적 dialogue 만).
--   · 모든 카피는 마이복서153 자체 세계관 — 환세취호권/어스토니시아/실존 복서/영화/만화/명언 0건.
--
-- NPC 어조 일관성:
--   · 강 관장 — 짧고 직설, 말끝 "..."
--   · 박 선배 — 회상 + 위로, 부드러움
--   · 민지 — 활기 + 미숙, 존댓말 + 감탄
--   · 도훈 — 진지 + 경쟁, 또래 반말 가끔
--   · 김 코치 — 전술적, 명령형 가끔
--   · 한 챔피언 — 단호 + 영감 (회상)
-- ============================================================

-- =====================================================================
-- 1. 기존 intro (sort_order 10) — enhanced 본문으로 UPDATE
-- =====================================================================
UPDATE public.boxing_story_dialogues d
SET body = '체육관 문을 열 때, 누구나 한 번 망설입니다. 거울 속의 내가 어색하고, 글러브가 무겁고, 옆 사람의 펀치 소리가 너무 큽니다... 그 망설임이 사라지는 게 아니라, 글러브를 끼는 일이 익숙해지는 것 — 그게 복서가 되는 첫 단계예요.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'master_01_first_glove'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '거울 앞에 또 섰습니다. 어제도, 그제도, 같은 자세를. 화려한 콤비네이션은 한참 멉니다. 가드를 올리고, 발을 옮기고, 잽 한 개. 다시 잽 한 개... 기본기는 자랑할 수 없는 무기예요. 하지만 가장 오래 남는 무기죠.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'master_02_basic_wall'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '오늘도 같은 동작입니다. 같은 라운드, 같은 시간, 같은 거울. 처음에는 지루합니다. 두 번째에는 짜증이 나고요. 세 번째부터 — 무언가 달라집니다. 반복은 지루함이 아니에요. 내 몸이 내 동작을 믿게 되는 시간이에요.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'master_03_repeat_room'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '오늘 신입이 들어왔어요. 어색하게 글러브를 묶고, 거울 앞에서 어쩔 줄 모르는 모습... 익숙한 풍경이에요. 그게 몇 달 전의 당신이었으니까. 내가 받았던 한마디를 — 이번엔 내가 줘야 하는 차례입니다.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'master_04_new_member'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '지도자의 눈은 다릅니다. 잘 치는지 보는 게 아니라, 다치지 않는지를 봐요. "팔꿈치가 너무 떨어졌어요" — 이 한마디가 누군가의 1년을 지킵니다. 평가하지 않고 살피는 시각이 — 이 자리의 출발점이에요.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'master_05_trainer_eye'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '오늘은 마스터룸입니다. 내가 후배에게 가르쳤던 자세를 — 내가 다시 받아봐요. 어떤 자세는 익숙하고, 어떤 자세는 낯설어요. 잘하는 사람이 마스터가 아니라, 안전하게 이끌 수 있는 사람이 마스터입니다.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'master_06_master_test'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '오늘 처음 와봤어요. 거창한 결심이 아니에요. 그냥 — 한 번 와본 거예요. 그게 복싱의 시작입니다. 거창한 사람이 시작하는 게 아니라, 그냥 와본 사람이 시작하는 거예요.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'pro_01_hobby_start'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '월화수목금. 같은 시간에 같은 자리. 처음에는 가기 싫었어요. 둘째 주에는 그냥 갔어요. 셋째 주부터 — 안 가면 이상합니다. 흔들리지 않는 마음이 생기는 게 아니에요. 흔들려도 가는 발걸음이 생기는 거예요.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'pro_02_routine_birth'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '심장이 빠르게 뜁니다. 첫 스파링. 도망가고 싶어요. 한 라운드만 해보자... 그게 시작이에요. 두려움은 사라지지 않아요. 두려움 안에서 한 발 내딛는 법을 배우는 거지.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'pro_03_first_spar_tension'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '3라운드 후 다리가 풀립니다. 4라운드 종은 안 울리길 바라요. 종이 울립니다. 한 발이 나가지 않아요. 그래도 한 발 더. 그게 복서의 정의예요. 끝까지 안 멈추는 사람.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'pro_04_stamina_wall'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '교과서 같은 폼이 있어요. 김 코치가 가르쳐 준 폼. 좋은 폼이에요. 하지만 — 어느 날 발견합니다. 내 몸이 만든 폼이 따로 있다는 걸. 나만의 거리, 나만의 박자, 나만의 한 방. 그게 보이기 시작하면 — 진짜가 시작이에요.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'pro_05_my_style'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '오늘은 컨디션이 별로예요. 어제 잠을 설쳤고, 어깨가 뻐근해요. 그래도 — 같은 루틴. 줄넘기 5라운드, 섀도복싱 3라운드, 미트 4라운드. 컨디션이 좋을 때 잘하는 건 누구나 해요. 컨디션이 나빠도 똑같이 하는 사람을 — 우리는 프로라고 부릅니다.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'pro_06_pro_routine_test'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '체육관 벽에 액자가 하나 걸려있어요. 153짐 출신 선배 한 분의 빛바랜 사진. 그 앞에 잠시 멈춥니다. 챔피언이 처음부터 챔피언이었을까요... 아니요. 챔피언이 되는 사람의 시작은 — 도전자의 문을 여는 그 한 걸음이에요.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'champ_01_contender_gate'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '거울 앞에 섰어요. 거울 속의 그 사람은 — 어제의 나입니다. 잘 안 풀린 라운드도, 포기하고 싶었던 순간도 거기 다 있어요. 오늘의 상대는 남이 아니에요. 어제의 나. 가장 정직한 라이벌은 — 거울 안에 있어요.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'champ_02_shadow_boxer'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '비슷한 시기에 들어온 사람이 있어요. 비슷한 레벨, 비슷한 고민. 처음엔 견제했어요. "저 사람보다 잘하고 싶다." 어느 날 깨달아요 — 라이벌은 적이 아니에요. 함께 자라는 거울이에요. 좋은 라이벌은 내 한계를 보여주는 사람이에요.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'champ_03_rival_match'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '시즌을 앞두고 캠프에 들어갑니다. 사람도 줄이고, 약속도 줄이고. 자기 자신과만 마주하는 시간이에요. 외롭습니다. 하지만 — 외로움 속에서 단단해지는 그 결이 있어요. 다른 사람이 없을 때 비로소 보이는 — 내 자세, 내 호흡, 내 의도.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'champ_04_fight_camp'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '체력은 바닥. 시간은 1분. 가드는 무겁고 발은 안 떨어져요. 그만 두고 싶어요. 종소리를 기다려요. 그래도 — 한 발 더. 한 잽 더. 한 라운드 더. 이 한 발이 — 챔피언의 정신이에요. 결과가 아니라 마음.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'champ_05_last_round'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

UPDATE public.boxing_story_dialogues d
SET body = '시즌이 끝났어요. 트로피를 들거나, 못 들거나. 양쪽 다 — 오늘 끝까지 라운드를 뛴 사람들이에요. 트로피보다 길게 남는 건 — 그날 코너에서 같이 떨었던 사람들의 얼굴이에요. 챔피언의 마음은 매일의 선택. 결과가 아니라 — 그 선택의 흔적입니다.'
FROM public.boxing_story_chapters c
WHERE d.chapter_id = c.id AND c.code = 'champ_06_champion_night'
  AND d.dialogue_type = 'intro' AND d.speaker = '오삼이';

-- =====================================================================
-- 2. 신규 dialogue INSERT helper
--    — chapter code + speaker + dialogue_type + sort_order 가
--    이미 있으면 skip (재실행 안전)
-- =====================================================================

-- 한 번만 호출되는 inline 함수 대신, 각 INSERT 마다 NOT EXISTS 가드 사용.

-- =====================================================================
-- A. master_01_first_glove
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '글러브 끈을 다시 묶었어요. 한 번, 두 번, 세 번. 매듭이 손에 익기 시작합니다. 작은 익숙함이 — 큰 변화의 시작이에요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'master_01_first_glove'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '첫 라운드가 끝났습니다. 숨이 차고 어색하지만, 거울 속의 당신은 어제와 다른 사람이에요. 첫 라운드를 끝까지 뛴 사람만이 — 두 번째 라운드를 가질 수 있어요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'master_01_first_glove'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '첫 글러브 인증서. 단순한 카드가 아니에요. "나는 시작했다" 는 증명입니다. 누군가는 평생 이걸 못 받아요. 시작이 그만큼 어렵거든요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'master_01_first_glove'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 사람이 아니에요. 내 안의 게으름입니다. 이불 속에서 "내일부터" 라고 속삭이는 그 목소리...', 50
FROM public.boxing_story_chapters c WHERE c.code = 'master_01_first_glove'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '강 관장', 'progress', '오늘 처음이지? 글러브 끈, 너무 꽉 묶지 마... 손목이 살짝 움직여야 정직한 펀치가 나와. 첫 라운드는 아무도 안 봐요. 거울만 봐.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'master_01_first_glove'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '강 관장' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '박 선배', 'progress', '내가 처음 왔을 때도 똑같았어요. 줄넘기 100개도 못 넘었지... 근데 그날 끝까지 안 나가서 — 지금 여기 있는 거예요. 끝까지 있는 사람이 결국 복서가 되더라고요.', 70
FROM public.boxing_story_chapters c WHERE c.code = 'master_01_first_glove'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '박 선배' AND d.dialogue_type = 'progress' AND d.sort_order = 70);

-- =====================================================================
-- B. master_02_basic_wall
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '잽 100개. 또 100개. 어깨가 무겁고 손목이 시큰해요. 이걸 왜 하는지 잠깐 잊혔다가 — 다시 기억나요. 정직한 한 개가, 흐트러진 열 개보다 무서워요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'master_02_basic_wall'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '거울 속 자세가 — 어느새 흔들리지 않아요. 화려한 변화는 없어요. 다만 가드가 천천히 단단해지고 있어요. 기본기는 자랑할 게 없지만, 가장 오래 남는 무기예요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'master_02_basic_wall'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '기본기는 보이지 않는 무기예요. 누구한테도 자랑 못해요. 하지만 — 결국 남는 사람과 떠나는 사람의 차이가 여기서 갈려요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'master_02_basic_wall'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 가드 브레이커. 자세가 무너지길 기다리는 그 습관이에요. "한 번쯤은 괜찮겠지" — 그 한 번이 모든 걸 바꿔요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'master_02_basic_wall'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '김 코치', 'progress', '왼쪽 어깨 떨어졌어요. 다시. 가드는 광대뼈 옆. 잽 칠 때 발이 같이 나가야 돼요. 하나, 둘. 다시. 자세 하나가 평생을 가요.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'master_02_basic_wall'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '김 코치' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '강 관장', 'complete', '잽이 깨끗해졌네... 이제 보일 거야. 다른 사람의 자세도. 자기 자세가 잡혀야 — 다른 사람 자세가 보여요.', 70
FROM public.boxing_story_chapters c WHERE c.code = 'master_02_basic_wall'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '강 관장' AND d.dialogue_type = 'complete' AND d.sort_order = 70);

-- =====================================================================
-- C. master_03_repeat_room
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '같은 동작을 또 합니다. 권태가 올라와요. "이거 의미 있나..." 그 순간이 가장 중요해요. 그 너머에서 — 신뢰가 시작돼요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'master_03_repeat_room'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '오늘은 같은 동작이 — 지루하지 않았어요. 내 몸이 내 동작을 믿기 시작한 거예요. 의심하지 않는 잽 한 개. 그게 백 개의 잽보다 무서워요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'master_03_repeat_room'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '반복은 지루함이 아니에요. 신뢰예요. 내 몸이 내 자세를 믿게 만드는 시간 — 그게 진짜 보상입니다.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'master_03_repeat_room'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 핑계 도깨비. 손가락으로 다른 곳을 가리키는 그 마음이에요. "오늘은 너무 더워서", "오늘은 어깨가 아파서"...', 50
FROM public.boxing_story_chapters c WHERE c.code = 'master_03_repeat_room'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '박 선배', 'progress', '저도 그 시기 있었어요. 한 달 동안 같은 거 하니까 진짜 지겹더라고요. 그래서 "오늘 안 갈래" 한 적도 있고. 근데 그 다음 날 갔더니 — 동작 하나가 달라져 있더라고요. 신기하죠. 안 가도 가르쳐 주는 게 있어요.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'master_03_repeat_room'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '박 선배' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

-- =====================================================================
-- D. master_04_new_member  (핵심)
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '신입은 자꾸 사람들 시선을 신경 써요. 거울 보기 부끄러워하고, 줄넘기 한 번 걸리면 얼굴이 빨개지고. 누가 와서 한마디 해주길 — 속으로 기다리고 있어요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'master_04_new_member'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '민지가 처음으로 줄넘기 100번을 성공했습니다. 거울 속에서 환하게 웃네요. 당신의 한마디 덕분이에요. "괜찮아요, 천천히 해도 돼요." — 짧지만, 그게 다였어요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'master_04_new_member'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '내가 받았던 한마디를 — 내가 줘야 하는 그 시점이 마스터의 길의 본격 시작이에요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'master_04_new_member'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 비교 괴물. 여러 개의 눈으로 다른 사람과 나를 끊임없이 견주는 그 마음이에요. 후배의 성장을 시기하는 그 작은 결도 — 같은 뿌리예요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'master_04_new_member'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '민지', 'progress', '저... 안녕하세요. 줄넘기를... 어떻게 해야 잘 넘어요? 어제 100번 넘기다가 50번에서 자꾸 걸려서요... 부끄러워서 사람들 안 보는 새벽에 와요.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'master_04_new_member'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '민지' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '박 선배', 'progress', '이제 당신 차례예요. 제가 했던 그 말 — 기억나요? "끝까지 있는 사람이 결국 복서가 된다." 이번엔 당신이 민지한테 해줄 차례예요.', 70
FROM public.boxing_story_chapters c WHERE c.code = 'master_04_new_member'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '박 선배' AND d.dialogue_type = 'progress' AND d.sort_order = 70);

-- =====================================================================
-- E. master_05_trainer_eye
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '오늘 민지가 미트 칠 때, 손목이 살짝 꺾이는 게 보였어요. 어제는 안 보였는데, 오늘은 보여요. 자기 자세를 잡은 사람만이 — 다른 사람의 위험을 봅니다.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'master_05_trainer_eye'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '민지가 부상 없이 한 달을 채웠어요. "팔꿈치 너무 떨어졌어요" — 당신이 한 그 한마디가, 한 사람의 1년을 지켰어요. 보이지 않는 일이 — 가장 큰 일이에요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'master_05_trainer_eye'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '지도자의 눈은 평가하는 눈이 아니에요. 다치지 않게 살피는 시각 — 그게 진짜 시선이에요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'master_05_trainer_eye'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 과훈련 골렘. "좀 더, 좀 더" 라고 속삭이는 그 마음이에요. 멈춰야 할 때 못 멈추는 — 그게 가장 위험한 적이에요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'master_05_trainer_eye'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '강 관장', 'progress', '잘 가르치는 게 아니라... 안 다치게 보는 거. 그게 다야. 칭찬은 짧고, 말리는 건 빨리. 소리 없이 끄덕이는 것 — 그게 가장 큰 칭찬이고.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'master_05_trainer_eye'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '강 관장' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '민지', 'complete', '선배님 덕분에 손목 안 다쳤어요! 진짜요! 어제 그 말 안 해주셨으면... 저 지금 한 달 쉬고 있었을걸요. 감사해요. 진짜 감사해요.', 70
FROM public.boxing_story_chapters c WHERE c.code = 'master_05_trainer_eye'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '민지' AND d.dialogue_type = 'complete' AND d.sort_order = 70);

-- =====================================================================
-- F. master_06_master_test  (졸업식 분위기)
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '마스터룸에 들어왔어요. 처음 글러브를 낀 그 자리와 같은 거울이에요. 거울 속의 당신은 — 같은 사람이지만, 같은 사람이 아니에요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'master_06_master_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '마스터의 길 — 6장이 끝났어요. 잘 치는 사람이 마스터가 아니라, 안전하게 이끄는 사람이 마스터입니다. 그 자리에 — 당신이 서 있어요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'master_06_master_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '"마스터 후보" — 칭호 하나, 카드 한 장. 화려하지 않아요. 다만 — 이걸 받은 사람만 알아요. 이 한 줄에 담긴 6개월의 무게를.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'master_06_master_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '마지막 적은 포기 악마예요. "여기까지 했으면 됐어" 라고 속삭이는 그 목소리. 끝나기 직전에 가장 크게 들리는 적이에요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'master_06_master_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '강 관장', 'complete', '잘 했어... 이제 너도 이 자리에서, 다음 사람을 보면 돼. 가르치는 게 아니라 — 안 다치게 보는 일. 그거면 충분해.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'master_06_master_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '강 관장' AND d.dialogue_type = 'complete' AND d.sort_order = 60);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '박 선배', 'complete', '6개월 만에 여기까지 왔네요. 처음 왔을 때 줄넘기 50번에서 걸리던 그 사람이... 이제 후배 가르치고 있어요. 시간이 한 사람을 이렇게 바꾸네요.', 70
FROM public.boxing_story_chapters c WHERE c.code = 'master_06_master_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '박 선배' AND d.dialogue_type = 'complete' AND d.sort_order = 70);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '민지', 'complete', '선배님!! 진짜 마스터 되셨어요?! 저도 언젠가... 저도 누군가한테 한마디 해줄 수 있을까요? 선배님이 저한테 해주신 것처럼요!', 80
FROM public.boxing_story_chapters c WHERE c.code = 'master_06_master_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '민지' AND d.dialogue_type = 'complete' AND d.sort_order = 80);

-- =====================================================================
-- G. pro_01_hobby_start
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '취미라고 했어요. 가볍게 시작했어요. 그런데 — 이상하게 다음 날도 오고 싶어요. 가벼운 발걸음이 — 깊은 발걸음이 되는 그 시작점이에요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'pro_01_hobby_start'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '한 라운드 더 뛰었어요. 거창한 결심 없이. 그게 시작이에요. 결심은 가끔 사라지지만 — "그냥 와본 사람" 의 발걸음은 — 이상하게 안 사라져요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'pro_01_hobby_start'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '취미반 인증서. "그냥 와본 사람" 의 첫 카드예요. 이게 제일 어려워요. 시작은 늘 어려워요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'pro_01_hobby_start'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 게으름 슬라임. 이불 속에서 "내일부터" 라고 속삭이는 그 작은 적이에요. 가장 자주 만나고 — 가장 끈질긴 적.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'pro_01_hobby_start'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '박 선배', 'progress', '취미여도 매일 오면 그게 프로예요. 진짜로요. 저도 처음에 "그냥 한 번 와봐야지" 했는데 — 5년이 됐네요. 시작은 가벼워도 돼요. 다만 — 다음 날에 또 오면.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'pro_01_hobby_start'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '박 선배' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

-- =====================================================================
-- H. pro_02_routine_birth
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '월화수목금. 같은 시간에 같은 자리. 처음 2주는 의지로 가요. 3주부터는 — 안 가면 이상해요. 의지가 습관으로 바뀌는 그 결이에요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'pro_02_routine_birth'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '한 달이 지났어요. 어제도 오고, 오늘도 왔어요. 흔들리지 않는 마음이 생긴 게 아니에요. 흔들려도 가는 발걸음이 — 생긴 거예요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'pro_02_routine_birth'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '루틴 카드. 가장 단순한 카드인데 가장 무거워요. "매일 같은 자리" — 이걸 한 사람만 받을 수 있는 카드예요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'pro_02_routine_birth'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 핑계 도깨비. "오늘은 비가 오니까", "오늘은 야근이니까" — 손가락으로 다른 곳을 가리키는 그 마음이에요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'pro_02_routine_birth'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '강 관장', 'progress', '오늘도 왔네... 그래. 잘하는 거 안 봐. 매일 오는 거만 봐. 매일 오는 사람이 결국 — 잘하더라.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'pro_02_routine_birth'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '강 관장' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

-- =====================================================================
-- I. pro_03_first_spar_tension
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '첫 스파링이에요. 헤드기어가 무거워요. 마우스피스가 어색해요. 종이 울리기 전 — 심장 소리가 가장 커요. 그 소리를 — 친구로 만들어야 돼요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'pro_03_first_spar_tension'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '한 라운드를 끝까지 뛰었어요. 잘 친 건 아니에요. 다만 — 도망가지 않은 게 중요해요. 두려움 안에서 한 발 내딛는 그 경험이 — 평생을 바꿔요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'pro_03_first_spar_tension'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '첫 스파링 카드. "심장 소리를 친구로 만든 사람" — 그 증명이에요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'pro_03_first_spar_tension'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 긴장 늑대. 종소리 직전에 송곳니를 드러내는 그 마음이에요. 식은땀, 떨리는 손, 막힌 호흡 — 그 모든 게 그 늑대의 그림자예요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'pro_03_first_spar_tension'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '김 코치', 'progress', '들어가기 전에. 가드는 광대 옆. 호흡은 코로 들이쉬고 입으로 — 짧게. 잽 두 번, 발 한 번. 안 맞아도 돼요. 도망가지만 마요. 그게 시작이에요.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'pro_03_first_spar_tension'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '김 코치' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '도훈', 'progress', '나도 처음이야. 살살 갈게. 너도 살살 가. 우리 둘 다 — 오늘이 첫 라운드잖아. 잘 치는 거 보다 — 끝까지 안 도망가는 거. 그거만 해보자.', 70
FROM public.boxing_story_chapters c WHERE c.code = 'pro_03_first_spar_tension'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '도훈' AND d.dialogue_type = 'progress' AND d.sort_order = 70);

-- =====================================================================
-- J. pro_04_stamina_wall
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '3라운드부터 다리가 풀려요. 가드가 무거워요. "오늘은 여기까지" 라고 몸이 말해요. 그 목소리가 가장 클 때 — 한 발 더 내딛는 사람이 있어요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'pro_04_stamina_wall'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '5라운드를 끝까지 뛰었어요. 다리는 후들거리고 숨은 차요. 그래도 — 종소리를 들었어요. 벽 앞에서 한 발 더 — 그게 복서의 정의예요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'pro_04_stamina_wall'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '체력의 벽 카드. "한 발 더" 가 어떤 무게인지 — 받아본 사람만 알아요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'pro_04_stamina_wall'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 숨참기 유령이에요. 힘들 때 호흡을 잠가버리는 그 습관 — 가장 조용히 다가오는 적이에요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'pro_04_stamina_wall'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '강 관장', 'progress', '벽 앞에서 한 발 더... 가는 사람을 우리는 복서라고 불러. 한 발 안 가도 괜찮아. 그냥, 다음 날에 또 오면 돼. 다음 날에 한 발 가면 — 그게 복서야.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'pro_04_stamina_wall'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '강 관장' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

-- =====================================================================
-- K. pro_05_my_style
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '교과서 같은 폼이 있어요. 좋은 폼이에요. 그런데 어느 날 — 내 몸이 만든 폼이 따로 있다는 걸 발견해요. 가르쳐 준 폼과 — 자라난 폼. 둘이 만나는 그 지점에 — 진짜 내 스타일이 있어요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'pro_05_my_style'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '나만의 거리, 나만의 박자, 나만의 한 방. 다른 사람과 다른 게 — 약점이 아니에요. 그게 — 내 무기예요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'pro_05_my_style'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '"나의 스타일" 카드. 카피가 아닌 한 사람의 증명이에요. 따라하지 않은 사람만 받을 수 있어요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'pro_05_my_style'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 비교 괴물이에요. 옆 사람의 폼을 자꾸 따라하게 만드는 그 마음. 자기 폼을 못 보게 가리는 — 가장 미세한 적이에요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'pro_05_my_style'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '김 코치', 'progress', '교과서대로 안 해도 돼요. 다만 — 안 다치게만. 본인 거리에서 본인 박자로. 그 안에서 자라는 폼이 — 진짜예요.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'pro_05_my_style'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '김 코치' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '박 선배', 'complete', '저는 5년 됐는데도 — 제 스타일이 뭔지 잘 모르겠어요. 근데 어느 날 보니까, 제 잽이 — 다른 사람과 좀 다르더라고요. 따라하려고 한 적 없는데. 자라는 거예요. 천천히.', 70
FROM public.boxing_story_chapters c WHERE c.code = 'pro_05_my_style'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '박 선배' AND d.dialogue_type = 'complete' AND d.sort_order = 70);

-- =====================================================================
-- L. pro_06_pro_routine_test
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '오늘 컨디션이 별로예요. 어제 잠을 설쳤고, 어깨가 뻐근해요. 그래도 — 같은 루틴. 줄넘기 5라운드, 섀도복싱 3라운드, 미트 4라운드.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'pro_06_pro_routine_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '컨디션 나빠도 같은 루틴을 끝냈어요. 잘하는 사람이 프로가 아니에요. 같은 사람이 — 프로예요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'pro_06_pro_routine_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '"프로 루틴 후보" 칭호와 카드. 컨디션이 평균 이하인 날에도 — 같은 자리에 선 사람의 증명이에요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'pro_06_pro_routine_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 과훈련 골렘이에요. "오늘 더 해야지" 라고 속삭이는 그 마음. 멈춰야 할 날을 못 멈추게 만드는 — 거대한 적.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'pro_06_pro_routine_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '강 관장', 'complete', '컨디션 안 좋다고 안 빠진 거 봤어... 잘했어. 더 안 해도 돼. 같은 거 했으면 그게 프로야.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'pro_06_pro_routine_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '강 관장' AND d.dialogue_type = 'complete' AND d.sort_order = 60);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '도훈', 'complete', '너 진짜 매일 같은 루틴 하더라. 부럽다. 나는 컨디션 나쁘면 빠지는데 — 너는 안 빠지더라고. 그게 — 진짜 차이인 거 같아.', 70
FROM public.boxing_story_chapters c WHERE c.code = 'pro_06_pro_routine_test'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '도훈' AND d.dialogue_type = 'complete' AND d.sort_order = 70);

-- =====================================================================
-- M. champ_01_contender_gate
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '체육관 벽 액자 앞에 섰어요. 빛바랜 사진의 그 분도 — 처음엔 도전자였어요. 챔피언이 되는 마음은 — 상을 받는 마음이 아니에요. 도전자의 문을 여는 그 한 걸음이에요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'champ_01_contender_gate'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '도전자의 문을 열었어요. 거창한 의식 없이 — 조용히. 진짜 시작은 — 이렇게 조용해요. 큰 결심이 아니라, 작은 한 걸음.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'champ_01_contender_gate'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '도전자 카드. 챔피언 카드보다 — 앞서 받는 카드예요. 챔피언은 — 도전자였던 사람만 될 수 있어요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'champ_01_contender_gate'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 긴장 늑대예요. "내가 감히 도전을?" 이라고 속삭이는 그 두려움. 시작 직전에 가장 크게 들리는 적이에요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'champ_01_contender_gate'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '한 챔피언', 'progress', '액자 속의 한 챔피언, 빛바랜 글자가 또렷해진다. "나도 처음엔 도전자였다. 잘 친 적도, 못 친 적도 있었지. 그저 — 다음 날에 또 왔을 뿐이다."', 60
FROM public.boxing_story_chapters c WHERE c.code = 'champ_01_contender_gate'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '한 챔피언' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

-- =====================================================================
-- N. champ_02_shadow_boxer  (NPC 없음)
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '거울 속의 그 사람을 가만히 봅니다. 잘 안 풀린 라운드도, 포기하고 싶었던 순간도 거기 다 있어요. 거울은 거짓말을 못 해요. 그래서 — 가장 정직한 라이벌이에요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'champ_02_shadow_boxer'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '오늘의 나는 어제의 나와 — 싸웠어요. 잽 한 개가 더 깨끗해요. 발 한 걸음이 더 가벼워요. 작은 차이지만 — 거울은 정직하게 보여줘요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'champ_02_shadow_boxer'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '그림자 복서 카드. "어제의 나와 겨룬 사람" — 가장 조용한 승리의 증명이에요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'champ_02_shadow_boxer'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 비교 괴물이에요. 옆 거울을 자꾸 보게 만드는 — 가장 미세한 적이에요. 어제의 나와 겨루지 못하게 시선을 돌리는.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'champ_02_shadow_boxer'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

-- =====================================================================
-- O. champ_03_rival_match  (핵심)
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '비슷한 시기에 들어온 사람이 있어요. 비슷한 레벨, 비슷한 고민. 처음엔 견제했어요. 어느 날 깨달아요 — 라이벌은 적이 아니라, 함께 자라는 거울이에요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'champ_03_rival_match'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '도훈과 한 라운드를 뛰었어요. 잘 친 사람도, 못 친 사람도 없어요. 둘 다 — 한 라운드 더 강해졌어요. 좋은 라이벌은 — 내 한계를 보여주는 사람이에요.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'champ_03_rival_match'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '라이벌 카드. 적이 아니라 거울. 견제가 아니라 — 함께 자라는 마음의 증명이에요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'champ_03_rival_match'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 긴장 늑대예요. 라이벌과 마주할 때 송곳니를 드러내는 그 마음. 이기고 싶은 욕망이 — 함께 자라는 마음을 가리는 적이에요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'champ_03_rival_match'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '도훈', 'progress', '한 라운드 더 가자. 너 잘 치는 거 알아. 나도 너 만나면서 늘었어. 우리 — 누가 이긴다보다 — 같이 한 발 더 가는 거. 그거 하자.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'champ_03_rival_match'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '도훈' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

-- =====================================================================
-- P. champ_04_fight_camp
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '캠프에 들어왔어요. 사람도 줄이고 약속도 줄이고. 자기 자신과만 마주해요. 외로워요. 하지만 — 외로움 속에서 단단해지는 결이 있어요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'champ_04_fight_camp'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '캠프가 끝났어요. 외로움을 견딘 자리에 — 단단함이 남았어요. 다른 사람이 없을 때 비로소 보이는 — 내 자세, 내 호흡, 내 의도.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'champ_04_fight_camp'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '파이트 캠프 카드. "혼자 단단해진 시간" 의 흔적이에요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'champ_04_fight_camp'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 과훈련 골렘이에요. 캠프 중 "더, 더" 라고 속삭이는 그 마음. 멈춰야 할 때 못 멈추게 만드는 가장 큰 적이에요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'champ_04_fight_camp'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '김 코치', 'progress', '오늘은 줄넘기 5라운드만. 더 안 해요. 캠프는 더 하는 시간이 아니라 — 정확히 하는 시간이에요. 휴식도 훈련의 일부고.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'champ_04_fight_camp'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '김 코치' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

-- =====================================================================
-- Q. champ_05_last_round
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '마지막 라운드. 가드는 무겁고 발은 안 떨어져요. 한 발만 더. 한 잽만 더. 챔피언의 정신은 — 결과가 아니라 마음이에요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'champ_05_last_round'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '마지막 종이 울렸어요. 다리는 후들거리지만 — 끝까지 갔어요. 이 한 발이 — 챔피언의 정신이에요. 트로피보다 길게 남는 마음의 흔적.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'champ_05_last_round'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '마지막 라운드 카드. 종소리를 들은 사람만이 — 받을 수 있는 카드예요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'champ_05_last_round'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 포기 악마예요. "이 정도면 됐어" 라고 속삭이는 그 목소리. 끝나기 직전에 가장 크게 들리는 — 가장 위험한 적이에요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'champ_05_last_round'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '김 코치', 'progress', '코너에서 들어. 가드 올려. 오른발만 신경 써. 잽 두 번, 백 스텝. 1분 남았어. 끝까지만 가. 잘 칠 필요 없어. 안 멈추기만 해.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'champ_05_last_round'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '김 코치' AND d.dialogue_type = 'progress' AND d.sort_order = 60);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '강 관장', 'progress', '한 발 더... 그게 다야. 잘 친 거 안 봐. 안 멈춘 거만 봐. 안 멈췄으면 — 이미 챔피언이야.', 70
FROM public.boxing_story_chapters c WHERE c.code = 'champ_05_last_round'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '강 관장' AND d.dialogue_type = 'progress' AND d.sort_order = 70);

-- =====================================================================
-- R. champ_06_champion_night  (전원 등장)
-- =====================================================================
INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'progress', '시즌이 끝나는 밤이에요. 트로피를 들거나, 못 들거나. 양쪽 다 — 오늘 끝까지 라운드를 뛴 사람들이에요. 챔피언의 마음은 — 매일의 선택이에요.', 20
FROM public.boxing_story_chapters c WHERE c.code = 'champ_06_champion_night'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'progress' AND d.sort_order = 20);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'complete', '챔피언 로드 — 6장이 끝났어요. 트로피보다 길게 남는 건 — 그날 코너에서 같이 떨었던 사람들의 얼굴이에요. 결과가 아니라 — 그 선택의 흔적입니다.', 30
FROM public.boxing_story_chapters c WHERE c.code = 'champ_06_champion_night'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'complete' AND d.sort_order = 30);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'reward', '"챔피언의 정신" 칭호와 카드. 트로피의 무게가 아니라 — 그날 함께 떨었던 사람들의 얼굴이 — 진짜 보상이에요.', 40
FROM public.boxing_story_chapters c WHERE c.code = 'champ_06_champion_night'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'reward' AND d.sort_order = 40);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '오삼이', 'boss', '앞에 있는 건 — 적이 없어요. 챔피언의 밤에는 적이 없어요. 모두가 — 같은 밤을 함께 끝낸 동료들이에요.', 50
FROM public.boxing_story_chapters c WHERE c.code = 'champ_06_champion_night'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '오삼이' AND d.dialogue_type = 'boss' AND d.sort_order = 50);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '강 관장', 'complete', '잘 했어... 진짜로. 트로피 봐도 안 봐도 — 같아. 끝까지 간 거. 그게 다야. 다음 시즌도 — 같은 자리에서 봐.', 60
FROM public.boxing_story_chapters c WHERE c.code = 'champ_06_champion_night'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '강 관장' AND d.dialogue_type = 'complete' AND d.sort_order = 60);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '박 선배', 'complete', '같이 시즌 뛰어줘서 고마워요. 저 혼자였으면 — 중간에 포기했을 거예요. 옆에서 떨고 있는 사람이 있다는 게 — 가장 큰 힘이에요.', 70
FROM public.boxing_story_chapters c WHERE c.code = 'champ_06_champion_night'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '박 선배' AND d.dialogue_type = 'complete' AND d.sort_order = 70);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '민지', 'complete', '선배님!! 진짜 시즌 끝까지 가셨어요?! 저는 오늘 처음 응원 왔는데 — 끝나는 그 순간 — 너무 멋있었어요. 저도 언젠가 이 자리에 설 수 있을까요?', 80
FROM public.boxing_story_chapters c WHERE c.code = 'champ_06_champion_night'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '민지' AND d.dialogue_type = 'complete' AND d.sort_order = 80);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '도훈', 'complete', '같이 시즌 뛰어서 다행이야. 너 없었으면 — 내 한계 못 봤을 거야. 다음 시즌도 — 같이 가자. 적이 아니라, 같은 길 가는 사람으로.', 90
FROM public.boxing_story_chapters c WHERE c.code = 'champ_06_champion_night'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '도훈' AND d.dialogue_type = 'complete' AND d.sort_order = 90);

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c.route_id, c.id, '김 코치', 'complete', '코너에서 본 마지막 1분 — 평생 못 잊어요. 안 멈추는 그 발걸음. 그게 — 챔피언이에요. 트로피와 상관없이.', 100
FROM public.boxing_story_chapters c WHERE c.code = 'champ_06_champion_night'
AND NOT EXISTS (SELECT 1 FROM public.boxing_story_dialogues d WHERE d.chapter_id = c.id AND d.speaker = '김 코치' AND d.dialogue_type = 'complete' AND d.sort_order = 100);

-- ============================================================
-- VERIFY (Supabase SQL Editor 에서 별도 쿼리로)
-- ------------------------------------------------------------
-- SELECT count(*) AS total FROM public.boxing_story_dialogues;
--   기대: ~120
--
-- SELECT speaker, count(*) AS cnt
-- FROM public.boxing_story_dialogues
-- GROUP BY speaker ORDER BY cnt DESC;
--   기대: 오삼이 ≥ 78, 강 관장 ≥ 8, 박 선배 ≥ 6,
--         민지 ≥ 4, 도훈 ≥ 4, 김 코치 ≥ 5, 한 챔피언 ≥ 1
--
-- SELECT c.code AS chapter, count(d.*) AS dialogues
-- FROM public.boxing_story_chapters c
-- LEFT JOIN public.boxing_story_dialogues d ON d.chapter_id = c.id
-- GROUP BY c.code ORDER BY c.code;
--   기대: 챕터당 5~10
-- ============================================================
