# 153 스토리 RPG — Stage 43A 프롬프트 (스토리 깊이 + NPC 등장)

> Claude Code 에 그대로 복붙. **DB seed 추가만, UI 코드 변경 없음** (안전).
>
> 끝나면 Supabase Dashboard 에 SQL 수동 실행 필요 (이전 단계와 동일 패턴).

---

## 사용법

1. Claude Code 열기
2. 아래 코드 블록 전체 복사
3. 붙여넣기 → 실행
4. 새 migration 파일 생성됨 → Supabase SQL Editor 에 수동 실행
5. 검증 SQL 로 dialogue 개수 확인
6. git commit + push

---

## Stage 43A 프롬프트 (전체 복사)

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG"의 스토리와 NPC 대사를 한국 클래식 RPG (환세취호권, 어스토니시아 스토리 등) 수준으로 풍부하게 작성하는 시니어 게임 시나리오 작가다.

이번 작업은 43A 단계다.
목표는 18개 챕터 × 3루트 의 인트로/진행/완료/보상 대사와 NPC 등장 대사를 감동적이고 깊이 있게 작성해서 boxing_story_dialogues 테이블에 추가하는 것이다.

이번 단계는 DB seed 추가 작업이다.
UI 코드 변경 X.
새 RPC 추가 X.
기존 테이블 스키마 변경 X.
이미 있는 18개 intro dialogue 는 enhanced 버전으로 UPSERT 갱신.

가장 중요한 보호 원칙 (이전 단계와 동일):
1. levels / missions / mission_videos / mission_submissions / member_progress 미수정.
2. 공식 XP 미지급. member_progress 일절 미수정.
3. 기존 ChatAssistant 외 새 AI 챗봇 만들지 않음.
4. 환세취호권 / 어스토니시아 / 실존 복서 / 영화 / 만화 / 실제 명언 — 캐릭터/명칭/대사/스토리 일절 차용 금지. 구조적 영감만.
5. 마이복서153 자체 세계관만 사용.

절대 수정 금지:
- levels / missions / mission_videos / mission_submissions / member_progress
- approve_mission_submission / record_attendance
- ChatAssistant / supabase/functions/chat-assistant
- 기존 /challenges 21일 챌린지 / challengeService / useWallet
- allLevelsData / whiteLevel1Data / sharedConstants 공식 훈련 데이터
- src/integrations/supabase/types.ts 직접 수동 수정 금지
- 기존 boxing_story_routes / boxing_story_chapters / boxing_story_nodes 테이블 schema 변경 금지
- 기존 RPC 5개 (get_my_story_rpg_state, choose_story_route, change_story_route, sync_story_chapter_progress, claim_story_chapter_reward) 변경 금지
- src 폴더 코드 변경 금지 (이번 단계는 SQL only)

허용되는 작업:
- 새 supabase migration 파일 1개 생성 (timestamp 단조 증가)
- boxing_story_dialogues 에 INSERT (UPSERT 패턴)
- 같은 (chapter_id, dialogue_type, sort_order) 충돌 시 ON CONFLICT DO UPDATE

═══════════════════════════════════════════════════════════════════
1. 스토리 바이블 — 3 루트의 narrative arc
═══════════════════════════════════════════════════════════════════

세계관 전제:
- 153복싱짐은 한국의 어느 동네 체육관. 다양한 사람이 모여있음.
- 회원은 평범한 사람으로 시작 — 학생, 직장인, 자영업자, 은퇴자.
- 복싱은 강해지는 길이 아니라 자기와 마주하는 길.
- 적은 사람이 아닌 자기 안의 습관 (게으름, 핑계, 비교, 포기).

A. 마스터의 길 — "내가 받은 것을 돌려주는 사람"
1. 첫 글러브 — 망설이는 신입 회원의 첫 발걸음
2. 기본기의 벽 — 화려함을 버리고 정직함을 배우는 시간
3. 반복의 방 — 권태를 신뢰로 바꾸는 구간
4. 후배의 등장 — 내가 받았던 한마디를 줘야 하는 차례
5. 지도자의 눈 — 평가가 아니라 안전을 보는 시각
6. 마스터 테스트 — 내가 가르친 자세를 내가 다시 받음

핵심 감정 곡선: 어색함 → 끈기 → 책임감 → 따뜻함

B. 프로의 길 — "매일 같은 자리에 서는 사람"
1. 취미반의 시작 — 거창한 결심 없이 그냥 와본 사람
2. 루틴의 탄생 — 흔들림이 사라지는 순간
3. 첫 스파링의 긴장 — 도망가고 싶은 마음과 마주
4. 체력의 벽 — 한 발 더 가는 사람이 복서
5. 나의 스타일 — 교과서가 아니라 내 몸이 만든 폼
6. 프로 루틴 테스트 — 컨디션 관계없이 같은 루틴

핵심 감정 곡선: 가벼움 → 진심 → 두려움 → 자기수용

C. 챔피언 로드 — "어제의 나와 겨루는 사람"
1. 도전자의 문 — 챔피언이 되는 사람의 시작 마음
2. 그림자 복서 — 거울 속 어제의 나와 대화
3. 라이벌 매칭 — 함께 자라는 거울 같은 동료
4. 파이트 캠프 — 외롭지만 단단해지는 시간
5. 마지막 라운드 — 한 발 더 — 챔피언의 정신
6. 챔피언 나이트 — 트로피보다 길게 남는 마음

핵심 감정 곡선: 호기심 → 자기대면 → 연대 → 헌신 → 평온

═══════════════════════════════════════════════════════════════════
2. NPC 등장 인물 (마이복서153 세계관)
═══════════════════════════════════════════════════════════════════

전 루트 공통 NPC (실존 인물 X — 모두 마이복서153 자체 캐릭터):

1. 강 관장 (강민호) — 153복싱짐 관장
   - 50대, 무뚝뚝하지만 따뜻함
   - 말이 짧고 직설적
   - "글러브 끈 너무 꽉 묶지 마." 같은 짧은 조언
   - 모든 회원에게 평등 — 잘하든 못하든 같은 시간 같은 시선
   - speaker 이름: "강 관장"

2. 선배 박 (박지현) — 5년 차 회원
   - 30대, 회사원, 평일 저녁 + 주말 새벽 운동
   - 든든한 멘토 — 자기 경험으로 위로
   - "내가 처음 왔을 때도 똑같았어." 류 회상
   - speaker 이름: "박 선배"

3. 신입 민지 (이민지) — 한 달 차 신입
   - 20대 초반 대학생
   - 활기차고 미숙 — 실수도 많지만 밝음
   - 마스터 챕터 4 (후배의 등장) 에서 핵심 인물
   - speaker 이름: "민지"

4. 라이벌 도훈 (윤도훈) — 비슷한 시기 입문한 또래
   - 비슷한 레벨에서 함께 성장
   - 챔피언 로드 챕터 3 (라이벌 매칭) 핵심 인물
   - speaker 이름: "도훈"

5. 챔피언 한 (한태영) — 153복싱짐 출신 가상의 명예 챔피언
   - 액자 사진 또는 회상 형태로만 등장 (인물 직접 등장 X)
   - 챔피언 로드 후반에 영감 인물로
   - speaker 이름: "한 챔피언" (회상)

6. 코너맨 김 (김동현) — 코치 / 코너맨
   - 30대 후반, 트레이너 자격증
   - 전술적 조언 — "오른발 위치", "어깨 떨어트려"
   - speaker 이름: "김 코치"

NPC 등장 원칙:
- 모든 NPC 는 실존 인물 무관 (성씨/이름 흔한 한국 이름)
- 캐릭터마다 말투가 명확히 구분되어야 함
- 각 NPC 가 챕터에 등장할 때 자연스러운 맥락 (예: 코너맨은 라운드 사이, 관장은 출입구에서)

═══════════════════════════════════════════════════════════════════
3. 대사 작성 가이드 — 환세취호권 톤 (저작권 회피)
═══════════════════════════════════════════════════════════════════

좋은 대사의 조건:
- 짧지만 깊다 (한 줄이지만 여운 있음)
- 비유보다 구체 (세부 묘사가 살아있음)
- 클리셰 회피 ("열심히 하면 돼!" X — 너무 흔함)
- 침묵 활용 (말줄임표 ... 적극 사용 — 환세취호권 특유)
- 한국어 리듬 (4-4 조 또는 7-5 조 자연스럽게)

피해야 할 표현:
- "꿈을 향해", "포기하지 마", "할 수 있어" 같은 자기계발 클리셰
- "최선을 다해라" 같은 명령형
- 영어 음역어 ("챔피언", "스파링" 같은 복싱 용어 외)
- 외국 격언 ("로마는 하루아침에..." 등)
- 실존 복서/영화/만화 인용

추구할 표현:
- "오늘은 그냥 거울만 봐도 됩니다"
- "벽 앞에서 한 발 더 — 그게 복서의 정의예요"
- "내가 받았던 한마디를 줘야 하는 차례입니다"
- "소리 없이 끄덕이는 것 — 그게 강 관장의 칭찬이에요"
- "심장이 빠르게 뜁니다... 도망가고 싶어도 괜찮아요"

═══════════════════════════════════════════════════════════════════
4. 챕터별 대사 spec
═══════════════════════════════════════════════════════════════════

각 챕터 (총 18개) 마다 다음 dialogue 추가/UPSERT:

A. intro (sort_order 10) — 기존 enhance
- 길이: 한글 120~180자
- 분위기: 챕터 시작 — 회원의 마음 묘사
- speaker: "오삼이"

B. progress (sort_order 20) — 신규
- 길이: 한글 80~140자
- 분위기: 챕터 중반 — 격려 또는 자기점검
- speaker: "오삼이"

C. complete (sort_order 30) — 신규
- 길이: 한글 100~160자
- 분위기: 챕터 클리어 직후 — 변화 포착
- speaker: "오삼이"

D. reward (sort_order 40) — 신규
- 길이: 한글 80~120자
- 분위기: 보상 받을 때 — 의미 부여
- speaker: "오삼이"

E. boss (sort_order 50) — 신규
- 길이: 한글 60~100자
- 분위기: 전투 진입 시 — 적(나쁜 습관) 묘사
- speaker: "오삼이"

F. NPC 1 (sort_order 60~80) — 신규
- 챕터 맥락에 맞는 NPC
- 길이: 한글 60~120자 (짧게 인간미 있게)
- speaker: 해당 NPC 이름

G. NPC 2 (sort_order 90~100, 선택) — 일부 챕터만
- 다른 NPC 등장
- 길이: 한글 60~120자

총 챕터당 ~5-7 dialogue × 18 챕터 = ~90-130 dialogue.

═══════════════════════════════════════════════════════════════════
5. 챕터별 NPC 배치 가이드 (필수 등장)
═══════════════════════════════════════════════════════════════════

마스터의 길:
1. 첫 글러브 — 강 관장 + 박 선배
2. 기본기의 벽 — 김 코치 + 강 관장
3. 반복의 방 — 박 선배
4. 후배의 등장 — 민지 (신입) — 핵심!
5. 지도자의 눈 — 강 관장 + 민지
6. 마스터 테스트 — 강 관장 + 박 선배 + 민지 (졸업식 분위기)

프로의 길:
1. 취미반의 시작 — 박 선배
2. 루틴의 탄생 — 강 관장
3. 첫 스파링의 긴장 — 김 코치 (전술 조언) + 도훈 (스파링 상대)
4. 체력의 벽 — 강 관장
5. 나의 스타일 — 김 코치 + 박 선배
6. 프로 루틴 테스트 — 강 관장 + 도훈

챔피언 로드:
1. 도전자의 문 — 한 챔피언 회상 (액자 보며)
2. 그림자 복서 — (NPC 없음 — 거울 속 자기와의 대화만)
3. 라이벌 매칭 — 도훈 — 핵심!
4. 파이트 캠프 — 김 코치
5. 마지막 라운드 — 김 코치 + 강 관장
6. 챔피언 나이트 — 강 관장 + 박 선배 + 민지 + 도훈 + 김 코치 (전원 등장)

═══════════════════════════════════════════════════════════════════
6. 샘플 대사 (퀄리티 기준)
═══════════════════════════════════════════════════════════════════

[챕터 master_01_first_glove]

intro (오삼이):
"체육관 문을 열 때, 누구나 한 번 망설입니다. 거울 속의 내가 어색하고, 글러브가 무겁고, 옆 사람의 펀치 소리가 너무 큽니다... 하지만 그 망설임이 사라지는 게 아니라, 글러브를 끼는 일이 익숙해지는 것 — 그게 복서가 되는 첫 단계예요."

NPC 강 관장:
"오늘 처음이지? 글러브 끈, 너무 꽉 묶지 마. 손목이 살짝 움직여야 정직한 펀치가 나와... 첫 라운드는 아무도 안 봐요. 거울만 봐."

NPC 박 선배:
"내가 처음 왔을 때도 똑같았어요. 줄넘기 100개도 못 넘었지... 근데 알아요? 내가 그날 끝까지 안 나가서 — 지금 여기 있는 거예요. 끝까지 있는 사람이 결국 복서가 되더라고요."

complete (오삼이):
"첫 라운드가 끝났습니다. 숨이 차고 어색하지만, 거울 속의 당신은 어제와 다른 사람이에요. 첫 라운드를 끝까지 뛴 사람만이 두 번째 라운드를 가질 수 있습니다."

boss (오삼이):
"앞에 있는 건 사람이 아니에요. 내 안의 게으름입니다. 이불 속에서 '내일부터' 라고 속삭이는 그 목소리..."

reward (오삼이):
"첫 글러브 인증서. 단순한 카드가 아니에요. '나는 시작했다' 는 증명입니다. 누군가는 평생 이걸 못 받아요. 시작이 그만큼 어렵거든요."

---

[챕터 master_04_new_member — 후배 등장]

intro (오삼이):
"오늘 신입이 들어왔어요. 어색하게 글러브를 묶고, 거울 앞에서 어쩔 줄 모르는 모습... 익숙한 풍경이에요. 그게 몇 달 전의 당신이었으니까."

NPC 민지 (신입):
"저... 안녕하세요. 줄넘기를... 어떻게 해야 잘 넘어요? 어제 100번 넘기다가 50번에서 자꾸 걸려서요... 부끄러워서 사람들 안 보는 새벽에 와요."

NPC 박 선배 (당신을 보며):
"이제 당신 차례예요. 제가 했던 그 말 — 기억나요? '끝까지 있는 사람이 결국 복서가 된다.' 이번엔 당신이 민지한테 해줄 차례예요."

complete (오삼이):
"민지가 처음으로 줄넘기 100번을 성공했습니다. 거울 속에서 환하게 웃네요. 당신의 한마디 덕분이에요. '괜찮아요, 천천히 해도 돼요.' — 짧지만, 그게 다였어요."

reward (오삼이):
"내가 받았던 한마디를 내가 줘야 하는 — 그 시점이 마스터의 길의 본격 시작입니다."

═══════════════════════════════════════════════════════════════════
7. 새 migration 파일
═══════════════════════════════════════════════════════════════════

파일명: supabase/migrations/YYYYMMDDHHMMSS_boxing_story_rpg_dialogues_v2.sql
(timestamp 는 마지막 migration 20260705000000 보다 단조 증가)

내용 구조:

-- ============================================================
-- 153 스토리 RPG 대사 풍부화 v2 (43A단계)
-- ============================================================
-- 18 챕터 × 5-7 dialogue (intro/progress/complete/reward/boss/NPC)
-- = 약 100~130 신규 dialogue
-- 기존 intro 18개는 ON CONFLICT 로 enhanced 버전 UPSERT
-- 신규 type/sort_order 는 INSERT
-- ============================================================

-- 충돌 처리:
INSERT INTO public.boxing_story_dialogues
  (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c2.route_id, c.id, '오삼이', 'intro', '...', 10
FROM (SELECT id, code FROM public.boxing_story_chapters) c
JOIN public.boxing_story_chapters c2 ON c2.id = c.id
JOIN (VALUES
  ('master_01_first_glove', '...'),
  ...
) AS d(code, body) ON d.code = c.code
ON CONFLICT (id) DO NOTHING; -- 또는 적절한 unique constraint

주의:
- 기존 boxing_story_dialogues 에 unique constraint 가 없으면 (chapter_id, dialogue_type, sort_order) 로 신규 추가
- 또는 이미 같은 sort_order intro 가 있으면 sort_order 11 로 시작해서 신규 추가
- 안전을 위해: ON CONFLICT 는 PRIMARY KEY (id) 만 가능하므로, 중복 회피는 NOT EXISTS WHERE 절로 처리

권장 패턴:

INSERT INTO public.boxing_story_dialogues (route_id, chapter_id, speaker, dialogue_type, body, sort_order)
SELECT c2.route_id, c.id, '강 관장', 'progress', '글러브 끈, 너무 꽉 묶지 마...', 60
FROM public.boxing_story_chapters c
JOIN public.boxing_story_chapters c2 ON c2.id = c.id
WHERE c.code = 'master_01_first_glove'
  AND NOT EXISTS (
    SELECT 1 FROM public.boxing_story_dialogues d
    WHERE d.chapter_id = c.id
      AND d.speaker = '강 관장'
      AND d.dialogue_type = 'progress'
      AND d.sort_order = 60
  );

또는 기존 intro 갱신:
UPDATE public.boxing_story_dialogues
SET body = '체육관 문을 열 때...'
WHERE chapter_id = (SELECT id FROM public.boxing_story_chapters WHERE code = 'master_01_first_glove')
  AND dialogue_type = 'intro'
  AND speaker = '오삼이';

═══════════════════════════════════════════════════════════════════
8. 18 챕터 전체 대사 — 작성 지시
═══════════════════════════════════════════════════════════════════

위 샘플 (master_01, master_04) 수준으로 18 챕터 전체 작성하라.

마스터의 길 (6 챕터):
- master_01_first_glove (샘플 참고)
- master_02_basic_wall — 거울 앞 반복. 김 코치 등장 — 자세 교정 잔소리.
- master_03_repeat_room — 권태와 신뢰. 박 선배 등장 — "지루함이 신뢰가 되는 순간".
- master_04_new_member (샘플 참고)
- master_05_trainer_eye — 안전한 시각. 민지 부상 → 당신이 멈춰주는 장면.
- master_06_master_test — 졸업식 톤. 강 관장 + 박 선배 + 민지 모두 등장.

프로의 길 (6 챕터):
- pro_01_hobby_start — 가벼운 시작. 박 선배 등장 — "취미여도 매일 오면 그게 프로".
- pro_02_routine_birth — 흔들리지 않는 마음. 강 관장 등장.
- pro_03_first_spar_tension — 두려움 + 도훈 (첫 스파링 상대). 김 코치 전술 조언.
- pro_04_stamina_wall — 한 발 더. 강 관장 — "벽 앞에서 한 발 더 가는 사람".
- pro_05_my_style — 자기 스타일. 김 코치 + 박 선배.
- pro_06_pro_routine_test — 같은 루틴. 강 관장 + 도훈 — 동등 인정.

챔피언 로드 (6 챕터):
- champ_01_contender_gate — 한 챔피언 액자. 회상 형태 대사 — "한 챔피언, 너도 처음엔 도전자였다".
- champ_02_shadow_boxer — NPC 없음. 거울 속 자기와의 독백. 오삼이가 중재.
- champ_03_rival_match — 도훈과 진정한 라이벌 관계. 함께 자라는 거울.
- champ_04_fight_camp — 외로운 시간. 김 코치 단독 — "혼자 단단해지는 시간".
- champ_05_last_round — 한 발 더. 김 코치 + 강 관장 코너에서.
- champ_06_champion_night — 전원 등장. 강 관장 + 박 선배 + 민지 + 도훈 + 김 코치. 트로피보다 길게 남는 마음.

각 NPC 의 어조 일관성 유지:
- 강 관장: 짧고 직설. 말끝 흐림 ("...")
- 박 선배: 회상 + 위로. 부드러움
- 민지: 활기 + 미숙. 존댓말 + 감탄
- 도훈: 진지 + 경쟁. 또래 반말 가끔
- 김 코치: 전술적. 명령형 가끔
- 한 챔피언 (회상): 단호 + 영감. 짧은 격언

═══════════════════════════════════════════════════════════════════
검증
═══════════════════════════════════════════════════════════════════

마이그레이션 작성 후, Supabase 적용 안내 문구 출력:

1. PowerShell:
   [System.IO.File]::ReadAllText("...새 파일 경로...", [System.Text.Encoding]::UTF8) | Set-Clipboard

2. Supabase Dashboard SQL Editor 에 붙여넣고 Run

3. 검증 SQL:
   SELECT count(*) FROM public.boxing_story_dialogues;
   -- 기대: 100~130

   SELECT speaker, count(*) FROM public.boxing_story_dialogues GROUP BY speaker;
   -- 기대: 오삼이 50+, 강 관장 10+, 박 선배 8+, 민지 4+, 도훈 4+, 김 코치 6+, 한 챔피언 1+

   SELECT chapter_id, count(*)
   FROM public.boxing_story_dialogues
   GROUP BY chapter_id
   ORDER BY count(*) DESC;
   -- 기대: 챕터당 5~7개

검증 통과 후 git commit + push:
- git add supabase/migrations
- git commit -m "feat(story-rpg): 스토리 깊이 + NPC 대사 (43A단계) — 18 챕터 × 5~7 dialogue + 6 NPC"
- git push origin main

작업 완료 후 출력:
1. 생성한 migration 파일명
2. 추가된 dialogue 총 개수
3. NPC 별 dialogue 개수
4. 챕터당 평균 dialogue 수
5. Supabase SQL Editor 실행 안내
6. 검증 SQL
7. 커밋 명령
8. git diff --stat 결과
```

---

## Stage 43A 완료 후 — Supabase 적용 + push

Claude Code 가 새 migration 파일 만들면:

### 1. PowerShell 에서 클립보드 복사

```powershell
[System.IO.File]::ReadAllText("C:\Users\82104\game-fit-quests\supabase\migrations\새_파일명.sql", [System.Text.Encoding]::UTF8) | Set-Clipboard
```

(실제 파일명은 Claude Code 가 알려줍니다 — `20260706000000_boxing_story_rpg_dialogues_v2.sql` 같은 형태)

### 2. Supabase Dashboard 에 적용

- https://supabase.com/dashboard/project/raoqefkwdpovwlgbibis
- SQL Editor → New query → Ctrl + V → Run

### 3. 검증 SQL (별도 New query)

```sql
SELECT count(*) AS total FROM public.boxing_story_dialogues;
-- 기대: 100~130

SELECT speaker, count(*) AS cnt
FROM public.boxing_story_dialogues
GROUP BY speaker
ORDER BY cnt DESC;
-- 기대: 오삼이 50+, NPC 들 다양

SELECT
  c.code AS chapter,
  count(d.*) AS dialogues
FROM public.boxing_story_chapters c
LEFT JOIN public.boxing_story_dialogues d ON d.chapter_id = c.id
GROUP BY c.code
ORDER BY c.code;
-- 기대: 챕터당 5~7
```

### 4. git push

```powershell
cd C:\Users\82104\game-fit-quests
git add supabase/migrations
git commit -m "feat(story-rpg): 스토리 깊이 + NPC 대사 (43A) — 18 챕터 × 5~7 dialogue + 6 NPC"
git push origin main
```

---

## 푸시 후 확인

DB 에 새 dialogue 들어갔지만 **UI 에서는 아직 인트로만 보임** (Stage 43B 에서 활용).

다만 인트로 자체는 enhanced 버전으로 갱신되어 있어서 — `/story-rpg` 에서 인트로 대사가 더 깊고 감동적으로 변경된 것을 확인 가능.

**다음 단계 안내:**

- Stage 43A 결과 만족 → **Stage 43B (턴제 전투)** prompt 작성 요청
- 더 풍부한 대사 원하면 43A 한 번 더 (NPC 추가, scene 추가 등)
- UI 에서 NPC 대사 활용 원하면 → 별도 작은 단계로 가능

검증 SQL 결과 + 운영 화면에서 인트로 대사 확인 후 알려주세요.
