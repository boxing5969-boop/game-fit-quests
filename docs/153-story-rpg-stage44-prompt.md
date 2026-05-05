# 153 스토리 RPG — Stage 44 프롬프트 (게임 시나리오 작성)

> Claude Code 에 그대로 복붙. **문서 1개만 생성** — 코드 변경 X, DB 변경 X.
>
> 이 단계 결과물 (시나리오 문서) 이 Stage 45 (DB 재설계) + Stage 46 (UI) 의 입력이 됩니다.

---

## 사용법

1. Claude Code 열기
2. 아래 코드 블록 전체 복사
3. 붙여넣기 → 실행
4. Claude Code 가 `docs/153-story-rpg-game-scenario.md` 작성 (~3-4시간)
5. 검토 후 commit + push

---

## Stage 44 프롬프트 (전체 복사)

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG" 독립형 게임 모드의 전체 시나리오를 작성하는 시니어 게임 시나리오 작가다.

이번 작업은 44단계다.
목표는 18 챕터 × 평균 8 씬 + 프롤로그 + 3 엔딩 + 11 적/보스 데이터를 한 문서에 완성하는 것.

이번 단계는 문서 작성 작업이다.
코드 X. DB migration X. 새 RPC X.
docs/153-story-rpg-game-scenario.md 1개 파일만 생성.

가장 중요한 보호 원칙:
1. 마이복서153 자체 콘텐츠만 사용. 환세취호권/실존 복서/영화/만화/실제 명언 차용 금지.
2. 표현물 100% 오리지널.
3. 폭력적 사람 공격 X — 적은 모두 나쁜 습관/감정.
4. 기존 43A NPC 6명 (강 관장, 박 선배, 민지, 도훈, 김 코치, 한 챔피언) 캐릭터 일관성 유지.

═══════════════════════════════════════════════════════════════════
세계관 / NPC 캐릭터 (43A 에서 정립됨, 그대로 활용)
═══════════════════════════════════════════════════════════════════

세계관:
- 153복싱짐. 한국 어느 동네 체육관.
- 회원은 평범한 사람 (학생/직장인/자영업자/은퇴자).
- 적은 사람 아닌 자기 안의 습관/감정.
- 복싱은 강해지는 길 X — 자기와 마주하는 길.

NPC:
1. 강 관장 (강민호) — 50대, 무뚝뚝+따뜻함, 짧고 직설, 말끝 흐림 ("...")
2. 박 선배 (박지현) — 30대, 5년차 회원, 멘토, 회상+위로
3. 민지 (이민지) — 20대 대학생, 신입, 활기+미숙, 존댓말+감탄
4. 도훈 (윤도훈) — 또래 라이벌, 진지+경쟁, 또래 반말 가끔
5. 김 코치 (김동현) — 30대 후반, 트레이너, 전술적+명령형
6. 한 챔피언 (한태영) — 가상의 명예 챔피언, 회상/액자 형태로만 등장, 단호+영감

═══════════════════════════════════════════════════════════════════
씬 타입 5종 — 정확한 payload 스키마
═══════════════════════════════════════════════════════════════════

각 씬은 scene_type 5종 중 하나.

A. dialogue
   payload:
     speaker: string  ("오삼이" or NPC name)
     body: string     (한글 60-200자, 타이프라이터 친화)
     portrait?: string ("osam" / "gwan" / "park" / "minji" / "dohun" / "kim" / "han_champion" / "self")
     bgm_hint?: string ("calm" / "tense" / "warm" / "epic")
   next_scene: integer  (다음 scene_index)

B. choice
   payload:
     prompt: string         (질문/상황 — 1-2문장)
     speaker?: string       (있으면 함께 표시)
     choices: array of {
       label: string          (선택지 텍스트, 한글 15-40자)
       hint?: string          (능력치 변동 미리보기 힌트)
       stat_changes?: {       (선택 시 능력치 변동, 모두 optional)
         hp?: int, focus?: int, skill?: int,
         guard?: int, grit?: int, respect?: int
       }
       inventory_grants?: array of card_code
       next_scene: integer    (선택 시 다음 scene_index)
     }

C. battle
   payload:
     enemy_code: string  (8 mob + 3 boss 중 하나)
     intro_line?: string (전투 진입 시 짧은 멘트, 한글 30-60자)
     victory_line?: string  (승리 직후 멘트)
     defeat_line?: string   (패배 시 멘트, 재도전 가능)
     reward_override?: { story_xp, ring_coins, card_code }
   next_scene_victory: integer  (승리 시 다음 scene)
   next_scene_defeat: integer   (패배 시 다음 scene — 보통 같은 전투 재시작 직전 씬)

D. node_move
   payload:
     from_node_code: string  (boxing_story_nodes.code)
     to_node_code: string
     transition_message?: string  (이동 중 표시, 한글 30-60자)
     animation_hint?: string  ("walk" / "run" / "fade")
   next_scene: integer

E. ending
   payload:
     ending_code: string         ("master_candidate" / "pro_routine" / "champion_spirit")
     title: string               ("마스터 후보" / "프로 루틴 후보" / "챔피언의 정신")
     subtitle: string
     cutscene_blocks: array of {  (풀스크린 컷씬 5-7 블록)
       type: "narration" | "image_caption" | "credits"
       speaker?: string
       body: string                (한글 80-200자)
       background?: string         ("gym_silhouette" / "ring_lights" / "starfield" / "sunrise")
     }
     reward_summary: {
       story_xp: int
       ring_coins: int
       real_gems_first_time: int  (200~500, 루트 최초만)
       title: string
       card_code: string
       badge_code: string
     }
   next_scene: -1  (엔딩이 끝)

═══════════════════════════════════════════════════════════════════
플레이어 능력치 (6종, 게임 시작 기본값)
═══════════════════════════════════════════════════════════════════

능력치       기본  상한  영향
체력 (HP)    100   200   0 되면 패배 (재시작)
집중 (focus) 10    30    명령 비용
기술 (skill) 10    50    잽/카운터 데미지
가드 (guard) 10    50    가드 명령 효과
투지 (grit)  10    50    회피/카운터 트리거 확률
리스펙트     0     100   NPC 호감도, 분기 잠금 해제

씬/선택지/전투에서 ± 변동.
오버플로우 방지: 상한 도달 시 더 안 오름.

═══════════════════════════════════════════════════════════════════
플레이어 명령 5종
═══════════════════════════════════════════════════════════════════

잽       — 빠른 기본 공격, 100% 적중, 데미지 = skill × 1.0,    집중 -1
가드     — 다음 턴 받는 피해 50% 감소,                          집중 0
풋워크   — 다음 턴 적 공격 회피율 +50%, 데미지 = skill × 0.6,   집중 -1
카운터   — 적이 공격 시 강한 반격 (skill × 2.5), 적이 방어/풋워크 시 실패, 집중 -2
오삼이 조언 — 힌트 (적 패턴 1턴 미리보기) 또는 집중 +3 (전투당 1회), 집중 0

═══════════════════════════════════════════════════════════════════
적 마스터 데이터 (11종)
═══════════════════════════════════════════════════════════════════

각 적의 정확한 stats / pattern / weakness 정의.
chapter 별 등장 적 매핑.

A. 일반 mob (8종):

1. lazy_slime (게으름 슬라임)
   chapter: master_01_first_glove, pro_01_hobby_start
   hp: 30
   attack: 5
   defense: 0
   pattern: 매 턴 50% sleep (자기 차례 스킵), 50% 약한 공격
   weakness: 잽 (효과 1.5배)
   reward: story_xp 30, ring_coins 20

2. guard_breaker (가드 브레이커)
   chapter: master_02_basic_wall
   hp: 60
   attack: 10
   defense: 5
   pattern: 3턴 차지 후 가드 무시 강공격 (skill_player × 2.0 데미지)
   weakness: 풋워크 (회피 가능)
   reward: story_xp 50, ring_coins 40

3. excuse_goblin (핑계 도깨비)
   chapter: master_03_repeat_room, pro_02_routine_birth
   hp: 50
   attack: 6
   defense: 3
   pattern: 매 턴 "오늘만 쉬자" 유혹 — 거절 선택지 (거절 시 grit +1)
   weakness: 카운터
   reward: story_xp 40, ring_coins 30

4. compare_monster (비교 괴물)
   chapter: master_04_new_member, pro_05_my_style, champ_02_shadow_boxer
   hp: 80
   attack: 8
   defense: 4
   pattern: 플레이어 능력치 1개 복사 후 사용 (랜덤)
   weakness: 자기 자신 — respect 50+ 시 데미지 1.5배
   reward: story_xp 60, ring_coins 50

5. quit_demon (포기 악마)
   chapter: master_06_master_test, champ_05_last_round
   hp: 100
   attack: 12
   defense: 5
   pattern: 매 턴 플레이어 집중 -1 도용
   weakness: 풋워크 + 카운터 콤보
   reward: story_xp 80, ring_coins 60

6. tense_wolf (긴장 늑대)
   chapter: pro_03_first_spar_tension, champ_01_contender_gate
   hp: 70
   attack: 15
   defense: 3
   pattern: 첫 턴 강력 공격, 후반 데미지 -50%
   weakness: 첫 턴 가드 → 카운터
   reward: story_xp 50, ring_coins 40

7. breath_holder (숨참기 유령)
   chapter: pro_04_stamina_wall
   hp: 60
   attack: 7
   defense: 2
   pattern: 회피율 60% (풋워크 안 통함). 카운터 시 회피율 무효
   weakness: 카운터
   reward: story_xp 50, ring_coins 40

8. overtrain_golem (과훈련 골렘)
   chapter: pro_06_pro_routine_test, champ_04_fight_camp
   hp: 150
   attack: 6
   defense: 8
   pattern: HP 매우 높음. 데미지 낮음. 지구전 — 매 턴 stamina 1 소모
   weakness: 잽 누적 (정직한 공격)
   reward: story_xp 70, ring_coins 60

B. 보스 (3종):

9. master_door (마스터의 문) — 마스터의 길 최종 보스
   chapter: master_06_master_test
   hp: 200
   attack: 12
   defense: 6
   pattern:
     1페이즈 (HP 100%-50%): 회원이 가르친 동작이 다시 자기에게 옴 (mirror attack — 직전 플레이어 명령 그대로 사용)
     2페이즈 (HP 50%-0%): 일반 강공격
   weakness: respect 80+ 필요 — 그래야만 1페이즈에서 가드/풋워크 효과
   reward: story_xp 200, ring_coins 300, title "마스터 후보", card "card_master_candidate"

10. routine_breaker (루틴 파괴자) — 프로의 길 최종 보스
    chapter: pro_06_pro_routine_test
    hp: 180
    attack: 10
    defense: 5
    pattern: 매 턴 플레이어 능력치 1개 무작위 -1 효과 (영구). 가드/풋워크 가능
    weakness: 가드/풋워크로 버티며 잽 누적 (조급함이 패배 원인)
    reward: story_xp 200, ring_coins 300, title "프로 루틴 후보", card "card_pro_routine"

11. self_compare_evolved (처음의 나 / 비교 괴물 진화형) — 챔피언 로드 최종 보스
    chapter: champ_06_champion_night
    2 페이즈 전투:
    1페이즈 — 처음의 나 (약함)
      hp: 50, attack: 4, defense: 2
      pattern: 플레이어 첫 챕터 시작할 때의 자기 모습. 약하지만 마음 아픈 대사
      weakness: 카운터 (절제된 한 방)
    2페이즈 — 비교 괴물 진화형 (강함)
      hp: 250, attack: 14, defense: 7
      pattern: 다른 사람과 비교, 플레이어 능력치 모두 합산해서 그 절반을 자기 공격력으로 사용
      weakness: respect + grit 합 100+ 시 데미지 1.5배
    reward: story_xp 250, ring_coins 400, title "챔피언의 정신", card "card_champion_spirit", badge "badge_champion"

═══════════════════════════════════════════════════════════════════
스토리 카드 (인벤토리 아이템)
═══════════════════════════════════════════════════════════════════

전투 중 1회 사용 가능한 강화 카드. 챕터 보상/숨겨진 씬에서 획득.

card_glove_first      — 첫 글러브 (기념)         사용: 데미지 +20%
card_jab_master       — 잽 마스터              사용: 다음 잽 회당 데미지 ×3
card_guard_iron       — 강철 가드              사용: 다음 1턴 무적
card_footwork_wind    — 바람의 풋워크           사용: 다음 2턴 회피율 100%
card_counter_lightning — 번개 카운터            사용: 다음 카운터 무조건 성공
card_respect_warmth   — 따뜻함의 마음            사용: 적 1턴 행동 멈춤 (+ respect +5)
card_master_candidate — 마스터 후보 (엔딩)        장식 카드, 효과 X
card_pro_routine      — 프로 루틴 후보 (엔딩)     장식 카드
card_champion_spirit  — 챔피언의 정신 (엔딩)      장식 카드

═══════════════════════════════════════════════════════════════════
프롤로그 시나리오 (게임 처음 시작 시 1회만)
═══════════════════════════════════════════════════════════════════

scenes:
0: dialogue — 오삼이 인사 + 게임 소개
   "안녕하세요. 저는 153복싱짐의 작은 마스코트, 오삼이에요. 오늘 당신은 처음 이 문 앞에 섰습니다..."

1: dialogue — 153복싱짐 입구 묘사
   "체육관 안에서 글러브가 샌드백을 치는 소리. 누군가의 줄넘기 소리. 거울 앞에 선 사람의 그림자... 모두가 처음엔 이 문 앞에서 망설였어요."

2: dialogue — 강 관장 등장
   speaker: 강 관장
   "어... 처음이지? 들어와요. 너무 무겁게 생각하지 말고."

3: choice — 게임 시작 (3 루트 선택)
   prompt: "오삼이가 묻습니다. '당신의 복서의 길은 어떤 모습인가요?'"
   choices:
     1) "후배에게 도움이 되는 사람" → 마스터의 길
     2) "매일 같은 자리에 서는 사람" → 프로의 길
     3) "어제의 나를 이기는 사람" → 챔피언 로드
   각 선택은 해당 루트의 chapter_01 첫 씬으로 분기

═══════════════════════════════════════════════════════════════════
챕터별 시나리오 작성 — 18 챕터 × ~8 씬
═══════════════════════════════════════════════════════════════════

각 챕터는 다음 구조 권장 (씬 수는 6-12 자유 조정):

scene 0: dialogue — 오삼이 챕터 인트로 (43A intro 활용 가능)
scene 1: node_move — 이전 노드에서 챕터 노드로 이동
scene 2: dialogue — NPC 등장 (43A NPC 대사 활용)
scene 3: choice — 첫 선택지 (능력치 변동 + 분기)
scene 4: dialogue — 분기별 반응 (NPC 또는 오삼이)
scene 5: battle — 챕터 적 전투
scene 6: dialogue — 전투 후 변화 묘사 (43A complete 활용)
scene 7: dialogue — 다음 장 예고 + 보상 안내

선택지 분기:
- 모든 선택은 next_scene 으로 분기 가능
- 합류 (다른 선택해도 같은 씬으로 모임) 도 가능
- 일부 선택은 숨겨진 씬 잠금 해제 (respect 50+ 등 조건)
- 능력치 변동은 균형 있게 (총합 0 근처)

배틀 씬:
- 보통 1-2개 (mob), 6번째 챕터는 보스 1개
- 일부 챕터는 mini battle (낮은 hp 적)

엔딩 분기 조건 (선택):
- respect 80+ 도달 시 보너스 엔딩 분기
- 모든 카드 수집 시 시크릿 씬

═══════════════════════════════════════════════════════════════════
샘플 — 챕터 1: 첫 글러브 (master_01_first_glove)
═══════════════════════════════════════════════════════════════════

scenes:

0: dialogue
   speaker: 오삼이
   body: "체육관 문을 열 때, 누구나 한 번 망설입니다. 거울 속의 내가 어색하고, 글러브가 무겁고, 옆 사람의 펀치 소리가 너무 큽니다... 오늘이 그 첫날이에요."
   bgm_hint: calm
   next_scene: 1

1: node_move
   from_node_code: gym_entrance
   to_node_code: gym_entrance
   transition_message: "153복싱짐 입구"
   next_scene: 2

2: dialogue
   speaker: 강 관장
   portrait: gwan
   body: "오늘 처음이지? 글러브 끈, 너무 꽉 묶지 마. 손목이 살짝 움직여야 정직한 펀치가 나와... 첫 라운드는 아무도 안 봐요. 거울만 봐."
   stat_change_on_arrive: { respect: +3 }
   next_scene: 3

3: choice
   prompt: "강 관장이 글러브를 건네줍니다. 당신은 어떻게 받겠어요?"
   choices:
     - label: "두 손으로 정중히 받는다"
       hint: "리스펙트 +5"
       stat_changes: { respect: +5 }
       next_scene: 4
     - label: "한 손으로 받는다"
       hint: "기술 +1"
       stat_changes: { skill: +1 }
       next_scene: 4
     - label: "어색하게 머뭇거린다"
       hint: "투지 +2"
       stat_changes: { grit: +2 }
       next_scene: 4

4: dialogue
   speaker: 박 선배
   portrait: park
   body: "내가 처음 왔을 때도 똑같았어요. 줄넘기 100개도 못 넘었지... 근데 알아요? 내가 그날 끝까지 안 나가서 — 지금 여기 있는 거예요. 끝까지 있는 사람이 결국 복서가 되더라고요."
   bgm_hint: warm
   next_scene: 5

5: dialogue
   speaker: 오삼이
   body: "거울 앞에 섰을 때, 익숙한 그림자가 따라옵니다. 게으름의 그림자. 어제도 오늘도 '내일부터'라고 속삭이는..."
   next_scene: 6

6: battle
   enemy_code: lazy_slime
   intro_line: "이불 속에서 들리던 목소리가 형체를 가집니다... 게으름 슬라임."
   victory_line: "녹색 거품이 천천히 흩어집니다. 오늘만큼은 이불 속에서 빠져나왔어요."
   defeat_line: "괜찮아요. 한 번 더 — 게으름은 한 번에 안 사라져요."
   next_scene_victory: 7
   next_scene_defeat: 5

7: dialogue
   speaker: 오삼이
   body: "첫 라운드가 끝났습니다. 숨이 차고 어색하지만, 거울 속의 당신은 어제와 다른 사람이에요. 첫 라운드를 끝까지 뛴 사람만이 두 번째 라운드를 가질 수 있습니다."
   bgm_hint: warm
   next_scene: 8

8: dialogue
   speaker: 오삼이
   body: "[챕터 1 클리어] 보상: 스토리 XP +60, 링 코인 +150, 카드 '첫 글러브' 획득. 다음 챕터 — 거울 앞에서 같은 자세를 반복합니다. 기본기의 벽."
   reward_grant: { story_xp: 60, ring_coins: 150, card: card_glove_first }
   next_scene: -1  (챕터 끝)

═══════════════════════════════════════════════════════════════════
엔딩 시나리오 (3종)
═══════════════════════════════════════════════════════════════════

A. 마스터 후보 엔딩 (master_candidate)
   배경: master_room
   톤: 졸업식 분위기 + 졸업 후 첫 출근

   scene 0: cutscene block (narration)
     "마스터의 문이 열립니다. 안에는 거울과 글러브, 그리고 신입 회원들의 명단."

   scene 1: cutscene block (dialogue)
     speaker: 강 관장
     "이제 당신은 후배에게 글러브 끈 묶는 법을 알려줄 사람이에요. 잘하라는 말은 안 해요. 안전하게 — 그것만 부탁해."

   scene 2: cutscene block (dialogue)
     speaker: 박 선배
     "축하해요. 내가 받았던 그 한마디를 — 이제 당신이 줄 차례."

   scene 3: cutscene block (dialogue)
     speaker: 민지
     "선배님... 처음 왔을 때 '괜찮아요, 천천히' 그 말... 잊지 못해요. 고맙습니다."

   scene 4: cutscene block (narration)
     "마스터 후보. 잘하는 사람이 아니라, 안전하게 이끄는 사람."

   scene 5: cutscene block (credits)
     "[엔딩: 마스터 후보] 보상: 스토리 XP +200, 링 코인 +300, 칭호 '마스터 후보', 카드 'card_master_candidate', 파이트 머니 +300 (최초 1회)"

B. 프로 루틴 후보 엔딩 (pro_routine)
   배경: ring 야간
   톤: 평범한 화요일 저녁의 위대함

   scene 0: narration
     "비가 오는 화요일 저녁. 체육관은 평소보다 한산하다. 그래도 거울 앞에는 — 같은 자세, 같은 시간."

   scene 1: dialogue (강 관장)
     "비 와도 오는 사람. 컨디션 나빠도 같은 루틴 하는 사람... 그게 프로의 정의야. 잘 왔어."

   scene 2: dialogue (도훈)
     "야, 너 진짜 매일 오더라. 나도 이젠 안 빠져. 너 때문에..."

   scene 3: narration
     "프로 루틴 후보. 매일 같은 자리에 서는 사람이 가장 무서운 복서."

   scene 4: credits
     "[엔딩: 프로 루틴 후보] 보상: 스토리 XP +200, 링 코인 +300, 칭호 '프로 루틴 후보', 카드 'card_pro_routine', 파이트 머니 +300 (최초 1회)"

C. 챔피언의 정신 엔딩 (champion_spirit)
   배경: boxing_hall + 새벽 일출
   톤: 트로피보다 길게 남는 마음

   scene 0: narration
     "체육관 문을 닫고 나오는 새벽 5시. 거리는 아직 어둡고, 차가운 공기가 글러브 냄새와 섞인다."

   scene 1: dialogue (오삼이)
     "오늘도 한 라운드를 끝까지 뛰었어요. 트로피는 없어요. 하지만 그 마음은 — 평생 남아요."

   scene 2: dialogue (한 챔피언, 회상)
     "내가 오늘 한 라운드를 뛴 이유는 — 어제의 내가 뛰었기 때문이야. 그게 챔피언의 정신이지."

   scene 3: dialogue (강 관장)
     "잘했어. 가서 좀 자."

   scene 4: dialogue (전원 — 박 선배, 민지, 도훈, 김 코치)
     "수고했어요!"
     "선배 짱!"
     "내일 또 봐."
     "다음 캠프에서 뵙죠."

   scene 5: narration
     "챔피언의 정신. 오늘 한 라운드를 끝까지 뛴 사람은 모두 자신의 챔피언입니다."

   scene 6: credits
     "[엔딩: 챔피언의 정신] 보상: 스토리 XP +250, 링 코인 +400, 칭호 '챔피언의 정신', 카드 'card_champion_spirit', 배지 'badge_champion', 파이트 머니 +500 (최초 1회)"

═══════════════════════════════════════════════════════════════════
출력 문서 형식
═══════════════════════════════════════════════════════════════════

생성 파일: docs/153-story-rpg-game-scenario.md

문서 구조:

# 153 스토리 RPG — 게임 시나리오

## 1. 개요
- 세계관 / NPC / 능력치 / 명령 / 적 / 카드 — 위 내용 그대로 정리

## 2. 프롤로그 시나리오
- 4 씬 (위 샘플 참고)

## 3. 마스터의 길 — 6 챕터 시나리오
### 챕터 1: 첫 글러브
- 8 씬 (샘플 참고)
### 챕터 2: 기본기의 벽
- 7-10 씬 — 직접 작성
### 챕터 3: 반복의 방
### 챕터 4: 후배의 등장
### 챕터 5: 지도자의 눈
### 챕터 6: 마스터 테스트 (보스: 마스터의 문)

## 4. 프로의 길 — 6 챕터 시나리오
### 챕터 1: 취미반의 시작
### 챕터 2: 루틴의 탄생
### 챕터 3: 첫 스파링의 긴장
### 챕터 4: 체력의 벽
### 챕터 5: 나의 스타일
### 챕터 6: 프로 루틴 테스트 (보스: 루틴 파괴자)

## 5. 챔피언 로드 — 6 챕터 시나리오
### 챕터 1: 도전자의 문
### 챕터 2: 그림자 복서
### 챕터 3: 라이벌 매칭
### 챕터 4: 파이트 캠프
### 챕터 5: 마지막 라운드
### 챕터 6: 챔피언 나이트 (보스: 처음의 나 / 비교 괴물 진화형)

## 6. 적 마스터 데이터
- 8 mob + 3 boss 표 정리

## 7. 스토리 카드 마스터 데이터
- 9 카드 표 정리

## 8. 능력치 변동 누적 표
- 각 챕터에서 가능한 stat 변동 합계 (밸런스 검증용)
- 평균 챕터 끝나면 stat 평균 +5~10 권장

## 9. 분기 트리 (선택지 → 분기 그래프)
- 각 챕터별 mermaid 또는 ascii 다이어그램

## 10. 운영 / 밸런싱 메모
- 평균 플레이타임 (챕터당 7-12분)
- 난이도 곡선 (1→6 chapter, 적 hp 1.5배씩 증가)
- 보상 곡선 (story_xp 60→200 점진 증가)
- 1 루트 = 60-75분 / 3 루트 = 3-4시간

작업 완료 후 출력:
1. 생성한 파일 경로
2. 총 씬 수 (예상 ~150)
3. 각 챕터별 씬 수 분포
4. 8 mob + 3 boss 데이터 완성 여부
5. 9 카드 데이터 완성 여부
6. 분기 트리 작성 여부
7. 다음 단계 (Stage 45 — DB 재설계) 안내
8. git diff --stat 결과
```

---

## Stage 44 완료 후 push

```powershell
cd C:\Users\82104\game-fit-quests
git add docs/153-story-rpg-game-scenario.md
git commit -m "docs(story-rpg): 게임 시나리오 (44단계) — 18챕터 + 프롤로그 + 3엔딩 + 11적 + 9카드 풀 시나리오"
git push origin main
```

---

## Stage 44 결과물 확인 후

문서 검토 — 만족하면:

- **Stage 45 (DB 재설계)** prompt 요청 → 신규 7 테이블 + 8 RPC 구현
- **시나리오 일부 수정 원하면** → 어느 챕터 / 어떤 부분 알려주세요

만족 안 하면 — 어떤 톤/분위기/캐릭터 강화 원하는지 알려주시면 Stage 44 prompt 수정 가능.

---

## 예상 작업 시간

- Claude Code 가 이 prompt 받으면 ~2-4시간 (대량 시나리오 작성)
- 결과물: 약 5,000~8,000 단어 한국어 문서
- 파일 크기: ~150-250KB

---

**중요:** 이 prompt 는 **순수 문서 작성** 만 시킵니다. 코드 / DB / migration / RPC — 모두 손대지 않음. Stage 45 에서 이 시나리오를 DB seed 로 변환합니다.
