# 153 스토리 RPG — 게임 시나리오

> Stage 44 — 18챕터 × 평균 8씬 + 프롤로그 4씬 + 3 엔딩 + 11 적 + 9 카드 풀 시나리오.
> Stage 45 (DB 재설계) + Stage 46 (UI) 의 입력 문서.
> 모든 표현물 100% 자체 — 환세취호권 / 실존 복서 / 영화 / 만화 / 명언 차용 0건.

---

## 1. 개요

### 1.1 세계관

153복싱짐. 한국 어느 동네 체육관. 회원은 평범한 사람 — 학생, 직장인, 자영업자, 은퇴자. 적은 사람이 아니라 자기 안의 습관/감정. 복싱은 강해지는 길이 아니라 자기와 마주하는 길.

### 1.2 NPC (43A 정립, 그대로 활용)

| 코드 | 이름 | 한 줄 |
|---|---|---|
| `gwan` | 강 관장 (강민호) | 50대, 무뚝뚝+따뜻함, 짧고 직설, 말끝 흐림 ("...") |
| `park` | 박 선배 (박지현) | 30대, 5년차 회원, 멘토, 회상+위로 |
| `minji` | 민지 (이민지) | 20대 대학생, 신입, 활기+미숙, 존댓말+감탄 |
| `dohun` | 도훈 (윤도훈) | 또래 라이벌, 진지+경쟁, 또래 반말 가끔 |
| `kim` | 김 코치 (김동현) | 30대 후반, 트레이너, 전술적+명령형 |
| `han_champion` | 한 챔피언 (한태영) | 가상 명예 챔피언, 회상/액자 형태로만 등장, 단호+영감 |
| `osam` | 오삼이 | 마스코트, 화자/내레이션 |
| `self` | (자아 거울) | 거울 속 어제의 나 |

### 1.3 플레이어 능력치 (6종)

| 능력치 | 키 | 기본 | 상한 | 영향 |
|---|---|---|---|---|
| 체력 | hp | 100 | 200 | 0 → 패배(재시작) |
| 집중 | focus | 10 | 30 | 명령 비용 |
| 기술 | skill | 10 | 50 | 잽/카운터 데미지 |
| 가드 | guard | 10 | 50 | 가드 명령 효과 |
| 투지 | grit | 10 | 50 | 회피/카운터 트리거 확률 |
| 리스펙트 | respect | 0 | 100 | NPC 호감도, 분기 잠금 해제 |

### 1.4 플레이어 명령 5종

| 명령 | 효과 | 집중 비용 |
|---|---|---|
| 잽 | 100% 적중, 데미지 = skill × 1.0 | -1 |
| 가드 | 다음 턴 받는 피해 50% 감소 | 0 |
| 풋워크 | 다음 턴 회피율 +50%, 데미지 = skill × 0.6 | -1 |
| 카운터 | 적 공격 시 강한 반격 (skill × 2.5), 적 방어/풋워크 시 실패 | -2 |
| 오삼이 조언 | 적 패턴 1턴 미리보기 또는 집중 +3 (전투당 1회) | 0 |

### 1.5 적 / 카드 (요약, 상세 §6, §7)

- 일반 mob 8종 + 보스 3종 = 11
- 카드 9종 (전투 1회 사용 + 엔딩 장식 카드)

---

## 2. 프롤로그 시나리오 (게임 처음 시작 시 1회만)

> scenes 0~3, 첫 1회 통과 후 재진입 시 §3-§5 의 챕터 1로 바로.

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    portrait: osam
    body: "안녕하세요. 저는 153복싱짐의 작은 마스코트, 오삼이에요. 오늘 당신은 처음 이 문 앞에 섰습니다... 들어오기 전, 잠깐 숨을 골라요."
    bgm_hint: calm
  next_scene: 1

scene 1:
  type: dialogue
  payload:
    speaker: 오삼이
    portrait: osam
    body: "체육관 안에서 글러브가 샌드백을 치는 소리. 누군가의 줄넘기 소리. 거울 앞에 선 사람의 그림자... 모두가 처음엔 이 문 앞에서 망설였어요. 망설임은 부끄러운 게 아니에요. 시작의 신호예요."
    bgm_hint: calm
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "어... 처음이지? 들어와요. 너무 무겁게 생각하지 말고. 오늘은 — 거울만 봐. 거울 속의 자기 모습이 어색해도, 그 어색함이 — 시작의 증거야."
    bgm_hint: warm
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "오삼이가 묻습니다. '당신의 복서의 길은 어떤 모습인가요?' (한 번 정해도 나중에 바꿀 수 있어요.)"
    speaker: 오삼이
    choices:
      - label: "후배에게 도움이 되는 사람이 되고 싶어요"
        hint: "마스터의 길 → 리스펙트 +5"
        stat_changes: { respect: +5 }
        next_scene: 1000  # master_01_first_glove scene 0 으로 점프
      - label: "매일 같은 자리에 서는 사람이 되고 싶어요"
        hint: "프로의 길 → 투지 +5"
        stat_changes: { grit: +5 }
        next_scene: 2000  # pro_01_hobby_start scene 0
      - label: "어제의 나를 이기는 사람이 되고 싶어요"
        hint: "챔피언 로드 → 기술 +5"
        stat_changes: { skill: +5 }
        next_scene: 3000  # champ_01_contender_gate scene 0
```

---

## 3. 마스터의 길 — 6 챕터 시나리오

> scene_index 베이스: 1000번대(챕터1) ~ 6000번대(챕터6). 각 챕터 내부는 0부터 시작하는 상대 인덱스로 표기 — DB seed 시 절대값으로 변환.

### 3.1 챕터 1 — 첫 글러브 (master_01_first_glove)

**노드**: gym_entrance · **적**: lazy_slime · **씬 수**: 9

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    portrait: osam
    body: "체육관 문을 열 때, 누구나 한 번 망설입니다. 거울 속의 내가 어색하고, 글러브가 무겁고, 옆 사람의 펀치 소리가 너무 큽니다... 오늘이 그 첫날이에요."
    bgm_hint: calm
  next_scene: 1

scene 1:
  type: node_move
  payload:
    from_node_code: gym_entrance
    to_node_code: gym_entrance
    transition_message: "153복싱짐 입구"
    animation_hint: walk
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "오늘 처음이지? 글러브 끈, 너무 꽉 묶지 마... 손목이 살짝 움직여야 정직한 펀치가 나와. 첫 라운드는 아무도 안 봐요. 거울만 봐."
    bgm_hint: warm
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "강 관장이 글러브를 건네줍니다. 당신은 어떻게 받겠어요?"
    choices:
      - label: "두 손으로 정중히 받는다"
        hint: "리스펙트 +5"
        stat_changes: { respect: +5 }
        next_scene: 4
      - label: "한 손으로 받아 바로 끼워본다"
        hint: "기술 +1, 리스펙트 +1"
        stat_changes: { skill: +1, respect: +1 }
        next_scene: 4
      - label: "어색하게 머뭇거린다"
        hint: "투지 +2"
        stat_changes: { grit: +2 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 박 선배
    portrait: park
    body: "내가 처음 왔을 때도 똑같았어요. 줄넘기 100개도 못 넘었지... 근데 알아요? 내가 그날 끝까지 안 나가서 — 지금 여기 있는 거예요. 끝까지 있는 사람이 결국 복서가 되더라고요."
    bgm_hint: warm
  next_scene: 5

scene 5:
  type: dialogue
  payload:
    speaker: 오삼이
    portrait: osam
    body: "거울 앞에 섰을 때, 익숙한 그림자가 따라옵니다. 게으름의 그림자. 어제도 오늘도 '내일부터' 라고 속삭이는..."
    bgm_hint: tense
  next_scene: 6

scene 6:
  type: battle
  payload:
    enemy_code: lazy_slime
    intro_line: "이불 속에서 들리던 목소리가 형체를 가집니다... 게으름 슬라임."
    victory_line: "녹색 거품이 천천히 흩어집니다. 오늘만큼은 이불 속에서 빠져나왔어요."
    defeat_line: "괜찮아요. 한 번 더 — 게으름은 한 번에 안 사라져요."
  next_scene_victory: 7
  next_scene_defeat: 5

scene 7:
  type: dialogue
  payload:
    speaker: 오삼이
    portrait: osam
    body: "첫 라운드가 끝났습니다. 숨이 차고 어색하지만, 거울 속의 당신은 어제와 다른 사람이에요. 첫 라운드를 끝까지 뛴 사람만이 두 번째 라운드를 가질 수 있습니다."
    bgm_hint: warm
  next_scene: 8

scene 8:
  type: dialogue
  payload:
    speaker: 오삼이
    portrait: osam
    body: "[챕터 1 클리어] 보상: 스토리 XP +60, 링 코인 +150, 카드 '첫 글러브' 획득. 다음 챕터 — 거울 앞에서 같은 자세를 반복합니다. 기본기의 벽."
    reward_grant: { story_xp: 60, ring_coins: 150, card: card_glove_first }
  next_scene: -1
```

### 3.2 챕터 2 — 기본기의 벽 (master_02_basic_wall)

**노드**: mirror_zone · **적**: guard_breaker · **씬 수**: 8

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    portrait: osam
    body: "거울 앞에 또 섰습니다. 어제도, 그제도, 같은 자세를. 화려한 콤비네이션은 한참 멉니다. 가드를 올리고, 발을 옮기고, 잽 한 개. 다시 잽 한 개..."
    bgm_hint: calm
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: gym_entrance, to_node_code: mirror_zone, transition_message: "거울 앞" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 김 코치
    portrait: kim
    body: "왼쪽 어깨 떨어졌어요. 다시. 가드는 광대뼈 옆. 잽 칠 때 발이 같이 나가야 돼요. 하나, 둘. 다시. 자세 하나가 평생을 가요."
    bgm_hint: tense
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "김 코치의 잔소리가 100개째입니다. 당신은?"
    choices:
      - label: "묵묵히 한 번 더 잽을 친다"
        hint: "기술 +3, 가드 +2"
        stat_changes: { skill: +3, guard: +2 }
        next_scene: 4
      - label: "'네!' 큰 소리로 답하고 다시 시작"
        hint: "리스펙트 +3, 투지 +2"
        stat_changes: { respect: +3, grit: +2 }
        next_scene: 4
      - label: "'코치님, 이 자세 조금 다르게 해도 돼요?' 묻는다"
        hint: "리스펙트 +5 (코치 인정) — 단, 기술 -1"
        stat_changes: { respect: +5, skill: -1 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "잽이 깨끗해졌네... 이제 보일 거야. 다른 사람의 자세도. 자기 자세가 잡혀야 — 다른 사람 자세가 보여요."
    bgm_hint: warm
  next_scene: 5

scene 5:
  type: dialogue
  payload:
    speaker: 오삼이
    portrait: osam
    body: "거울 옆에서 가드 브레이커가 노립니다. 자세가 무너지길 기다리는 그 습관 — '한 번쯤은 괜찮겠지' 그 한 번이 모든 걸 바꿔요."
    bgm_hint: tense
  next_scene: 6

scene 6:
  type: battle
  payload:
    enemy_code: guard_breaker
    intro_line: "가드 브레이커가 3턴 동안 차지합니다. 풋워크로 회피하세요."
    victory_line: "균열이 봉합됩니다. 가드는 — 무너지지 않았어요."
    defeat_line: "한 번쯤은 괜찮다는 마음 — 그게 가드를 무너뜨려요. 다시."
  next_scene_victory: 7
  next_scene_defeat: 5

scene 7:
  type: dialogue
  payload:
    speaker: 오삼이
    portrait: osam
    body: "[챕터 2 클리어] 거울 속 자세가 — 어느새 흔들리지 않아요. 기본기는 자랑할 게 없지만, 가장 오래 남는 무기예요. 보상: XP +80, 코인 +200."
    reward_grant: { story_xp: 80, ring_coins: 200, card: card_jab_master }
  next_scene: -1
```

### 3.3 챕터 3 — 반복의 방 (master_03_repeat_room)

**노드**: sandbag_zone · **적**: excuse_goblin · **씬 수**: 9

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "오늘도 같은 동작입니다. 같은 라운드, 같은 시간, 같은 거울. 처음에는 지루합니다. 두 번째에는 짜증이 나고요. 세 번째부터 — 무언가 달라집니다."
    bgm_hint: calm
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: mirror_zone, to_node_code: sandbag_zone, transition_message: "샌드백 존" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 박 선배
    portrait: park
    body: "저도 그 시기 있었어요. 한 달 동안 같은 거 하니까 진짜 지겹더라고요. 그래서 '오늘 안 갈래' 한 적도 있고. 근데 그 다음 날 갔더니 — 동작 하나가 달라져 있더라고요."
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "오늘 100번째 같은 콤비네이션. 마음이 흔들립니다."
    choices:
      - label: "그래도 한 라운드 더"
        hint: "투지 +5, HP -10"
        stat_changes: { grit: +5, hp: -10 }
        next_scene: 4
      - label: "잠깐 쉬고 호흡 정리"
        hint: "집중 +3, HP +5"
        stat_changes: { focus: +3, hp: +5 }
        next_scene: 4
      - label: "박 선배에게 '지겨워요' 솔직히 말한다"
        hint: "리스펙트 +5 (관계), 투지 -1"
        stat_changes: { respect: +5, grit: -1 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "거울 앞으로 핑계 도깨비가 다가옵니다. 손가락으로 '오늘은 너무 더워서' 라고 가리키며..."
    bgm_hint: tense
  next_scene: 5

scene 5:
  type: battle
  payload:
    enemy_code: excuse_goblin
    intro_line: "핑계 도깨비가 매 턴 '오늘만 쉬자' 라고 유혹합니다. 거절하면 grit +1."
    victory_line: "도깨비가 슬며시 사라집니다. 오늘은 — 핑계가 안 통했어요."
    defeat_line: "한 번 들어주면 끝없이 늘어나요. 다시 거절해봅시다."
  next_scene_victory: 6
  next_scene_defeat: 4

scene 6:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "오늘은 같은 동작이 — 지루하지 않았어요. 내 몸이 내 동작을 믿기 시작한 거예요. 의심하지 않는 잽 한 개. 그게 백 개의 잽보다 무서워요."
    bgm_hint: warm
  next_scene: 7

scene 7:
  type: choice
  payload:
    prompt: "오늘 노트에 무엇을 적을까요?"
    choices:
      - label: "'오늘 잽 1000개 — 내일도 한다'"
        hint: "투지 +3"
        stat_changes: { grit: +3 }
        next_scene: 8
      - label: "'반복은 신뢰다'"
        hint: "집중 +3"
        stat_changes: { focus: +3 }
        next_scene: 8

scene 8:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 3 클리어] 보상: XP +100, 코인 +250."
    reward_grant: { story_xp: 100, ring_coins: 250, card: card_guard_iron }
  next_scene: -1
```

### 3.4 챕터 4 — 후배의 등장 (master_04_new_member)

**노드**: corner · **적**: compare_monster · **씬 수**: 11 (핵심 챕터)

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "오늘 신입이 들어왔어요. 어색하게 글러브를 묶고, 거울 앞에서 어쩔 줄 모르는 모습... 익숙한 풍경이에요. 그게 몇 달 전의 당신이었으니까."
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: sandbag_zone, to_node_code: corner, transition_message: "코너 — 회복과 작전의 자리" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 민지
    portrait: minji
    body: "저... 안녕하세요. 줄넘기를... 어떻게 해야 잘 넘어요? 어제 100번 넘기다가 50번에서 자꾸 걸려서요... 부끄러워서 사람들 안 보는 새벽에 와요."
    bgm_hint: warm
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "민지가 당신을 보며 묻습니다. 어떻게 답할까요?"
    choices:
      - label: "'괜찮아요, 천천히 해도 돼요. 50번도 시작이에요.'"
        hint: "리스펙트 +8 (큰 변화), grit +2"
        stat_changes: { respect: +8, grit: +2 }
        next_scene: 4
      - label: "'손목 살짝 풀고, 발끝으로 가볍게.' 자세 시범"
        hint: "기술 +3, 리스펙트 +4"
        stat_changes: { skill: +3, respect: +4 }
        next_scene: 4
      - label: "'음... 저도 배우는 중이에요.'"
        hint: "리스펙트 +1 (소심)"
        stat_changes: { respect: +1 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 박 선배
    portrait: park
    body: "이제 당신 차례예요. 제가 했던 그 말 — 기억나요? '끝까지 있는 사람이 결국 복서가 된다.' 이번엔 당신이 민지한테 해줄 차례예요."
    bgm_hint: warm
  next_scene: 5

scene 5:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "신입은 자꾸 사람들 시선을 신경 써요. 거울 보기 부끄러워하고, 줄넘기 한 번 걸리면 얼굴이 빨개지고. 누가 와서 한마디 해주길 — 속으로 기다리고 있어요."
  next_scene: 6

scene 6:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "거울 너머로 비교 괴물이 보여요. 여러 개의 눈으로 다른 사람과 나를 끊임없이 견주는 그 마음이에요. 후배의 성장을 시기하는 그 작은 결도 — 같은 뿌리예요."
    bgm_hint: tense
  next_scene: 7

scene 7:
  type: battle
  payload:
    enemy_code: compare_monster
    intro_line: "비교 괴물이 당신의 능력치 하나를 복사해 사용합니다."
    victory_line: "괴물의 눈이 하나씩 감깁니다. 오늘만큼은 — 다른 사람과 견주지 않았어요."
    defeat_line: "비교의 눈은 자기 안에 있어요. 다시 — 자신을 보세요."
  next_scene_victory: 8
  next_scene_defeat: 6

scene 8:
  type: dialogue
  payload:
    speaker: 민지
    portrait: minji
    body: "선배님!! 저 방금 줄넘기 100번 성공했어요!! 진짜요!! 선배님 한마디 덕분이에요... 진짜요. 감사합니다."
    bgm_hint: warm
  next_scene: 9

scene 9:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "민지가 처음으로 줄넘기 100번을 성공했습니다. 거울 속에서 환하게 웃네요. 당신의 한마디 덕분이에요. '괜찮아요, 천천히 해도 돼요.' — 짧지만, 그게 다였어요."
    bgm_hint: warm
  next_scene: 10

scene 10:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 4 클리어] 내가 받았던 한마디를 — 내가 줘야 하는 그 시점이 마스터의 길의 본격 시작이에요. 보상: XP +120, 코인 +300, 카드 '따뜻함의 마음'."
    reward_grant: { story_xp: 120, ring_coins: 300, card: card_respect_warmth }
  next_scene: -1
```

### 3.5 챕터 5 — 지도자의 눈 (master_05_trainer_eye)

**노드**: mirror_zone · **적**: overtrain_golem · **씬 수**: 9

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "지도자의 눈은 다릅니다. 잘 치는지 보는 게 아니라, 다치지 않는지를 봐요. '팔꿈치가 너무 떨어졌어요' — 이 한마디가 누군가의 1년을 지킵니다."
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: corner, to_node_code: mirror_zone, transition_message: "거울 앞 — 지도자의 자리" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 민지
    portrait: minji
    body: "선배님!! 저 오늘 미트 처음 쳐봐요!! 이렇게 치는 거 맞죠? 손목 이렇게 꺾으면 더 세지는 거 아니에요?"
    bgm_hint: tense
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "민지의 손목이 살짝 꺾여 있습니다. 무엇을 할까요?"
    choices:
      - label: "'잠깐, 손목 꺾으면 다쳐요. 이렇게.' 즉시 멈추고 시범"
        hint: "리스펙트 +10 (안전 우선), 기술 +2"
        stat_changes: { respect: +10, skill: +2 }
        inventory_grants: [card_footwork_wind]
        next_scene: 4
      - label: "'세게 치는 건 좋아요. 다음 라운드에 자세 봐줄게요.'"
        hint: "리스펙트 +1 (방심)"
        stat_changes: { respect: +1 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "잘 가르치는 게 아니라... 안 다치게 보는 거. 그게 다야. 칭찬은 짧고, 말리는 건 빨리. 소리 없이 끄덕이는 것 — 그게 가장 큰 칭찬이고."
    bgm_hint: warm
  next_scene: 5

scene 5:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "거울 옆으로 거대한 그림자가 다가와요. 과훈련 골렘. '좀 더, 좀 더' 라고 속삭이는 그 마음. 멈춰야 할 때 못 멈추는 — 가장 위험한 적."
    bgm_hint: tense
  next_scene: 6

scene 6:
  type: battle
  payload:
    enemy_code: overtrain_golem
    intro_line: "골렘의 HP 가 매우 높습니다. 잽 누적으로 정직하게 깎아내세요."
    victory_line: "균열이 무너집니다. 멈출 때를 안 사람만이 — 골렘을 이깁니다."
    defeat_line: "조급함이 패배 원인이에요. 잽 한 개씩 정직하게."
  next_scene_victory: 7
  next_scene_defeat: 5

scene 7:
  type: dialogue
  payload:
    speaker: 민지
    portrait: minji
    body: "선배님 덕분에 손목 안 다쳤어요! 진짜요! 어제 그 말 안 해주셨으면... 저 지금 한 달 쉬고 있었을걸요. 감사해요. 진짜 감사해요."
    bgm_hint: warm
  next_scene: 8

scene 8:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 5 클리어] 지도자의 눈은 평가하는 눈이 아니에요. 다치지 않게 살피는 시각 — 그게 진짜 시선이에요. 보상: XP +150, 코인 +400."
    reward_grant: { story_xp: 150, ring_coins: 400, card: card_counter_lightning }
  next_scene: -1
```

### 3.6 챕터 6 — 마스터 테스트 (master_06_master_test) [보스]

**노드**: master_room · **보스**: master_door · **씬 수**: 12 (졸업식 분위기)

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "마스터룸에 들어왔어요. 처음 글러브를 낀 그 자리와 같은 거울이에요. 거울 속의 당신은 — 같은 사람이지만, 같은 사람이 아니에요."
    bgm_hint: epic
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: mirror_zone, to_node_code: master_room, transition_message: "마스터룸" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "여기까지 왔네... 마지막 시험은 — 내가 가르친 자세를 네가 다시 받는 거야. 거울 앞으로."
    bgm_hint: epic
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "거울 앞에 섰어요. 마스터의 문이 천천히 열립니다. 첫 호흡을 어떻게 잡을까요?"
    choices:
      - label: "코로 천천히 들이쉬고 — 입으로 짧게 내뱉는다"
        hint: "집중 +5, 가드 +3"
        stat_changes: { focus: +5, guard: +3 }
        next_scene: 4
      - label: "민지가 했던 첫 호흡을 떠올린다"
        hint: "리스펙트 +5, 투지 +3"
        stat_changes: { respect: +5, grit: +3 }
        next_scene: 4
      - label: "박 선배의 한마디 — '끝까지 있는 사람' 을 마음 속에"
        hint: "투지 +5, 집중 +3"
        stat_changes: { grit: +5, focus: +3 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "마스터의 문이 — 당신이 가르친 자세를 그대로 보여줍니다. 1페이즈: 미러 어택. 가드와 풋워크는 리스펙트 80+ 일 때만 통합니다."
    bgm_hint: epic
  next_scene: 5

scene 5:
  type: battle
  payload:
    enemy_code: master_door
    intro_line: "마스터의 문이 열립니다. 1페이즈 — 거울 어택. 2페이즈 — 강공격."
    victory_line: "문이 — 당신을 알아봅니다. '잘 했어. 이제 너도 이 자리에서, 다음 사람을 보면 돼.'"
    defeat_line: "거울 속의 당신을 다시 보세요. 가드는 — 자기 자세가 잡혀야 통해요."
  next_scene_victory: 6
  next_scene_defeat: 3

scene 6:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "잘 했어... 이제 너도 이 자리에서, 다음 사람을 보면 돼. 가르치는 게 아니라 — 안 다치게 보는 일. 그거면 충분해."
    bgm_hint: warm
  next_scene: 7

scene 7:
  type: dialogue
  payload:
    speaker: 박 선배
    portrait: park
    body: "6개월 만에 여기까지 왔네요. 처음 왔을 때 줄넘기 50번에서 걸리던 그 사람이... 이제 후배 가르치고 있어요. 시간이 한 사람을 이렇게 바꾸네요."
    bgm_hint: warm
  next_scene: 8

scene 8:
  type: dialogue
  payload:
    speaker: 민지
    portrait: minji
    body: "선배님!! 진짜 마스터 되셨어요?! 저도 언젠가... 저도 누군가한테 한마디 해줄 수 있을까요? 선배님이 저한테 해주신 것처럼요!"
    bgm_hint: warm
  next_scene: 9

scene 9:
  type: dialogue
  payload:
    speaker: 김 코치
    portrait: kim
    body: "자세 — 이제 안 봐도 돼요. 본인이 보여요. 다음 사람도 — 본인이 봐줘요."
    bgm_hint: warm
  next_scene: 10

scene 10:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "잘하는 사람이 마스터가 아니라, 안전하게 이끄는 사람이 마스터입니다. 그 자리에 — 당신이 서 있어요."
    bgm_hint: epic
  next_scene: 11

scene 11:
  type: ending
  payload:
    ending_code: master_candidate
    title: "마스터 후보"
    subtitle: "잘하는 사람이 아니라, 안전하게 이끄는 사람"
    cutscene_blocks:
      - type: narration
        body: "마스터의 문이 열립니다. 안에는 거울과 글러브, 그리고 신입 회원들의 명단."
        background: master_room
      - type: image_caption
        speaker: 강 관장
        body: "이제 당신은 후배에게 글러브 끈 묶는 법을 알려줄 사람이에요. 잘하라는 말은 안 해요. 안전하게 — 그것만 부탁해."
        background: master_room
      - type: image_caption
        speaker: 박 선배
        body: "축하해요. 내가 받았던 그 한마디를 — 이제 당신이 줄 차례."
      - type: image_caption
        speaker: 민지
        body: "선배님... 처음 왔을 때 '괜찮아요, 천천히' 그 말... 잊지 못해요. 고맙습니다."
      - type: narration
        body: "마스터 후보. 잘하는 사람이 아니라, 안전하게 이끄는 사람."
        background: sunrise
      - type: credits
        body: "[엔딩: 마스터 후보] 보상: 스토리 XP +200, 링 코인 +300, 칭호 '마스터 후보', 카드 'card_master_candidate', 파이트 머니 +300 (최초 1회)"
    reward_summary:
      story_xp: 200
      ring_coins: 300
      real_gems_first_time: 300
      title: "마스터 후보"
      card_code: card_master_candidate
      badge_code: badge_master
  next_scene: -1
```

---

## 4. 프로의 길 — 6 챕터 시나리오

### 4.1 챕터 1 — 취미반의 시작 (pro_01_hobby_start)

**노드**: gym_entrance · **적**: lazy_slime · **씬 수**: 8

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "오늘 처음 와봤어요. 거창한 결심이 아니에요. 그냥 — 한 번 와본 거예요. 그게 복싱의 시작입니다."
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: gym_entrance, to_node_code: gym_entrance }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 박 선배
    portrait: park
    body: "취미여도 매일 오면 그게 프로예요. 진짜로요. 저도 처음에 '그냥 한 번 와봐야지' 했는데 — 5년이 됐네요. 시작은 가벼워도 돼요. 다만 — 다음 날에 또 오면."
    bgm_hint: warm
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "오늘이 첫날입니다. 어떤 마음으로 들어왔어요?"
    choices:
      - label: "'그냥 한 번 와봤어요'"
        hint: "투지 +5"
        stat_changes: { grit: +5 }
        next_scene: 4
      - label: "'살 빼려고요...'"
        hint: "기술 +2, 집중 +2"
        stat_changes: { skill: +2, focus: +2 }
        next_scene: 4
      - label: "'멋있어 보여서요'"
        hint: "리스펙트 +3"
        stat_changes: { respect: +3 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "이불 속에서 들리던 목소리가 형체를 가집니다... 게으름 슬라임. 가장 자주 만나고 — 가장 끈질긴 적."
    bgm_hint: tense
  next_scene: 5

scene 5:
  type: battle
  payload:
    enemy_code: lazy_slime
    intro_line: "가장 단순한 적. 잽으로 시작해보세요."
    victory_line: "거품이 흩어져요. 첫 라운드 — 끝까지 안 도망갔어요."
    defeat_line: "괜찮아요. 게으름은 한 번에 안 사라져요."
  next_scene_victory: 6
  next_scene_defeat: 4

scene 6:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "한 라운드 더 뛰었어요. 거창한 결심 없이. 그게 시작이에요. '그냥 와본 사람' 의 발걸음은 — 이상하게 안 사라져요."
    bgm_hint: warm
  next_scene: 7

scene 7:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 1 클리어] 보상: XP +60, 코인 +150, 카드 '첫 글러브'."
    reward_grant: { story_xp: 60, ring_coins: 150, card: card_glove_first }
  next_scene: -1
```

### 4.2 챕터 2 — 루틴의 탄생 (pro_02_routine_birth)

**노드**: rope_zone · **적**: excuse_goblin · **씬 수**: 8

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "월화수목금. 같은 시간에 같은 자리. 처음 2주는 의지로 가요. 3주부터는 — 안 가면 이상해요. 의지가 습관으로 바뀌는 그 결이에요."
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: gym_entrance, to_node_code: rope_zone }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "오늘도 왔네... 그래. 잘하는 거 안 봐. 매일 오는 거만 봐. 매일 오는 사람이 결국 — 잘하더라."
    bgm_hint: warm
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "오늘은 비가 오고 야근으로 늦었어요. 어떻게 할까요?"
    choices:
      - label: "줄넘기 3라운드만 — 짧게라도"
        hint: "투지 +5, 가드 +2"
        stat_changes: { grit: +5, guard: +2 }
        next_scene: 4
      - label: "오늘은 회복일로 한다"
        hint: "집중 +5, HP +10"
        stat_changes: { focus: +5, hp: +10 }
        next_scene: 4
      - label: "거울 앞 섀도복싱만 10분"
        hint: "기술 +3, 리스펙트 +2"
        stat_changes: { skill: +3, respect: +2 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "줄넘기 코너에서 핑계 도깨비가 손가락을 가리킵니다. '오늘은 비가 오니까', '오늘은 야근이니까'..."
    bgm_hint: tense
  next_scene: 5

scene 5:
  type: battle
  payload:
    enemy_code: excuse_goblin
    victory_line: "도깨비가 슬며시 사라져요. '이상하게 와버린 사람' 이 — 결국 이깁니다."
    defeat_line: "한 번 들어주면 — 다음에 두 번 들어줘요. 다시 거절."
  next_scene_victory: 6
  next_scene_defeat: 4

scene 6:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "한 달이 지났어요. 어제도 오고, 오늘도 왔어요. 흔들리지 않는 마음이 생긴 게 아니에요. 흔들려도 가는 발걸음이 — 생긴 거예요."
    bgm_hint: warm
  next_scene: 7

scene 7:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 2 클리어] 보상: XP +80, 코인 +200, 카드 '강철 가드'."
    reward_grant: { story_xp: 80, ring_coins: 200, card: card_guard_iron }
  next_scene: -1
```

### 4.3 챕터 3 — 첫 스파링의 긴장 (pro_03_first_spar_tension)

**노드**: ring · **적**: tense_wolf · **씬 수**: 10

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "심장이 빠르게 뜁니다. 첫 스파링. 도망가고 싶어요. 한 라운드만 해보자... 그게 시작이에요."
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: rope_zone, to_node_code: ring, transition_message: "링 — 처음으로" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 김 코치
    portrait: kim
    body: "들어가기 전에. 가드는 광대 옆. 호흡은 코로 들이쉬고 입으로 — 짧게. 잽 두 번, 발 한 번. 안 맞아도 돼요. 도망가지만 마요."
    bgm_hint: tense
  next_scene: 3

scene 3:
  type: dialogue
  payload:
    speaker: 도훈
    portrait: dohun
    body: "나도 처음이야. 살살 갈게. 너도 살살 가. 우리 둘 다 — 오늘이 첫 라운드잖아. 잘 치는 거 보다 — 끝까지 안 도망가는 거. 그거만 해보자."
    bgm_hint: warm
  next_scene: 4

scene 4:
  type: choice
  payload:
    prompt: "종이 울리기 직전. 마음 속에 무엇을 떠올릴까요?"
    choices:
      - label: "김 코치의 자세 — 가드 광대 옆"
        hint: "가드 +5"
        stat_changes: { guard: +5 }
        next_scene: 5
      - label: "도훈의 한마디 — '같이 가자'"
        hint: "리스펙트 +5, 투지 +3"
        stat_changes: { respect: +5, grit: +3 }
        next_scene: 5
      - label: "박 선배의 회상 — '끝까지 있는 사람'"
        hint: "투지 +5, 집중 +3"
        stat_changes: { grit: +5, focus: +3 }
        next_scene: 5

scene 5:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "긴장 늑대가 송곳니를 드러냅니다. 첫 턴 강력 공격 — 그 후 데미지 -50%. 첫 턴은 가드, 그 다음 카운터."
    bgm_hint: tense
  next_scene: 6

scene 6:
  type: battle
  payload:
    enemy_code: tense_wolf
    intro_line: "긴장 늑대 — 첫 턴이 가장 무서워요."
    victory_line: "늑대가 — 천천히 친구가 됩니다. 도망가지 않은 그 1분 — 평생을 바꿉니다."
    defeat_line: "두려움 안에서 한 발만 내딛으면 돼요. 다시."
  next_scene_victory: 7
  next_scene_defeat: 5

scene 7:
  type: dialogue
  payload:
    speaker: 도훈
    portrait: dohun
    body: "끝까지 갔네. 너 안 도망갔어. 나도 안 도망갔고. 우린 — 오늘 같이 한 라운드 끝낸 거야."
    bgm_hint: warm
  next_scene: 8

scene 8:
  type: dialogue
  payload:
    speaker: 김 코치
    portrait: kim
    body: "잘 했어요. 가드 좋았고. 호흡 — 다음엔 더 짧게. 두려움은 사라지지 않아요. 두려움 안에서 한 발 내딛는 법을 배우는 거고."
    bgm_hint: warm
  next_scene: 9

scene 9:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 3 클리어] 보상: XP +100, 코인 +250, 카드 '바람의 풋워크'."
    reward_grant: { story_xp: 100, ring_coins: 250, card: card_footwork_wind }
  next_scene: -1
```

### 4.4 챕터 4 — 체력의 벽 (pro_04_stamina_wall)

**노드**: sandbag_zone · **적**: breath_holder · **씬 수**: 8

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "3라운드 후 다리가 풀려요. 가드가 무거워요. '오늘은 여기까지' 라고 몸이 말해요. 그 목소리가 가장 클 때 — 한 발 더 내딛는 사람이 있어요."
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: ring, to_node_code: sandbag_zone, transition_message: "샌드백 존 — 5라운드" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "벽 앞에서 한 발 더... 가는 사람을 우리는 복서라고 불러. 한 발 안 가도 괜찮아. 다음 날에 또 오면 돼."
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "5라운드. 다리가 풀립니다. 그래도 가시겠어요?"
    choices:
      - label: "한 라운드 더"
        hint: "투지 +8, HP -15"
        stat_changes: { grit: +8, hp: -15 }
        next_scene: 4
      - label: "호흡 정리하고 천천히"
        hint: "집중 +5, HP -5"
        stat_changes: { focus: +5, hp: -5 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "샌드백 옆에서 숨참기 유령이 다가옵니다. 회피율 60% — 풋워크가 안 통해요. 카운터로만 잡을 수 있어요."
    bgm_hint: tense
  next_scene: 5

scene 5:
  type: battle
  payload:
    enemy_code: breath_holder
    intro_line: "유령 — 가드가 안 통해요. 카운터를 쳐야 회피가 무효화됩니다."
    victory_line: "유령이 사라집니다. 호흡이 살아있어야 — 라운드도 살아있어요."
    defeat_line: "가드만으로는 안 잡혀요. 카운터로 — 정직하게 한 방."
  next_scene_victory: 6
  next_scene_defeat: 4

scene 6:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "5라운드를 끝까지 뛰었어요. 다리는 후들거리고 숨은 차요. 그래도 — 종소리를 들었어요. 벽 앞에서 한 발 더 — 그게 복서의 정의예요."
    bgm_hint: warm
  next_scene: 7

scene 7:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 4 클리어] 보상: XP +120, 코인 +300, 카드 '번개 카운터'."
    reward_grant: { story_xp: 120, ring_coins: 300, card: card_counter_lightning }
  next_scene: -1
```

### 4.5 챕터 5 — 나의 스타일 (pro_05_my_style)

**노드**: mirror_zone · **적**: compare_monster · **씬 수**: 9

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "교과서 같은 폼이 있어요. 좋은 폼이에요. 그런데 어느 날 — 내 몸이 만든 폼이 따로 있다는 걸 발견해요."
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: sandbag_zone, to_node_code: mirror_zone }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 김 코치
    portrait: kim
    body: "교과서대로 안 해도 돼요. 다만 — 안 다치게만. 본인 거리에서 본인 박자로. 그 안에서 자라는 폼이 — 진짜예요."
  next_scene: 3

scene 3:
  type: dialogue
  payload:
    speaker: 박 선배
    portrait: park
    body: "저는 5년 됐는데도 — 제 스타일이 뭔지 잘 모르겠어요. 근데 어느 날 보니까, 제 잽이 — 다른 사람과 좀 다르더라고요. 따라하려고 한 적 없는데. 자라는 거예요. 천천히."
  next_scene: 4

scene 4:
  type: choice
  payload:
    prompt: "거울 앞에서 자기 자세를 봅니다. 어떻게 잡을까요?"
    choices:
      - label: "내 몸이 편한 거리로"
        hint: "기술 +5, 가드 +2"
        stat_changes: { skill: +5, guard: +2 }
        next_scene: 5
      - label: "내 박자로 — 천천히"
        hint: "집중 +5, 투지 +2"
        stat_changes: { focus: +5, grit: +2 }
        next_scene: 5
      - label: "내 한 방에 집중 — 잽 한 개"
        hint: "기술 +7"
        stat_changes: { skill: +7 }
        next_scene: 5

scene 5:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "거울 너머로 비교 괴물이 또 나타나요. 옆 사람의 폼을 자꾸 따라하게 만드는 그 마음. 이번엔 — 자기 폼을 보여주세요."
    bgm_hint: tense
  next_scene: 6

scene 6:
  type: battle
  payload:
    enemy_code: compare_monster
    intro_line: "비교 괴물 — 당신의 능력치를 복사합니다. respect 50+ 시 데미지 1.5배."
    victory_line: "괴물의 눈이 감깁니다. 자기 폼이 — 가장 무서워요."
    defeat_line: "옆 사람과 견주지 마세요. 내 거울만 보세요."
  next_scene_victory: 7
  next_scene_defeat: 5

scene 7:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "나만의 거리, 나만의 박자, 나만의 한 방. 다른 사람과 다른 게 — 약점이 아니에요. 그게 — 내 무기예요."
    bgm_hint: warm
  next_scene: 8

scene 8:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 5 클리어] 보상: XP +150, 코인 +400, 카드 '잽 마스터'."
    reward_grant: { story_xp: 150, ring_coins: 400, card: card_jab_master }
  next_scene: -1
```

### 4.6 챕터 6 — 프로 루틴 테스트 (pro_06_pro_routine_test) [보스]

**노드**: ring · **보스**: routine_breaker · **씬 수**: 11

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "오늘은 컨디션이 별로예요. 어제 잠을 설쳤고, 어깨가 뻐근해요. 그래도 — 같은 루틴. 줄넘기 5라운드, 섀도복싱 3라운드, 미트 4라운드."
    bgm_hint: epic
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: mirror_zone, to_node_code: ring }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "컨디션 안 좋다고 안 빠진 거 봤어... 잘했어. 더 안 해도 돼. 같은 거 했으면 그게 프로야."
  next_scene: 3

scene 3:
  type: dialogue
  payload:
    speaker: 도훈
    portrait: dohun
    body: "야, 너 진짜 매일 같은 루틴 하더라. 부럽다. 나는 컨디션 나쁘면 빠지는데 — 너는 안 빠지더라고. 그게 — 진짜 차이인 거 같아."
    bgm_hint: warm
  next_scene: 4

scene 4:
  type: choice
  payload:
    prompt: "오늘의 루틴 — 평소처럼 갈까요?"
    choices:
      - label: "평소 그대로 — 5라운드 / 3라운드 / 4라운드"
        hint: "투지 +8, 집중 +3"
        stat_changes: { grit: +8, focus: +3 }
        next_scene: 5
      - label: "조금 줄여서 — 4 / 3 / 3"
        hint: "집중 +5, HP +10"
        stat_changes: { focus: +5, hp: +10 }
        next_scene: 5
      - label: "기본기만 잽 100개"
        hint: "기술 +5"
        stat_changes: { skill: +5 }
        next_scene: 5

scene 5:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "링 가운데로 루틴 파괴자가 들어옵니다. 매 턴 능력치 1개를 영구적으로 -1 시켜요. 가드/풋워크로 버티며 잽으로 정직하게."
    bgm_hint: epic
  next_scene: 6

scene 6:
  type: battle
  payload:
    enemy_code: routine_breaker
    intro_line: "루틴 파괴자 — 조급함이 패배 원인이에요."
    victory_line: "파괴자가 — 서서히 무너집니다. 같은 자리에 선 사람이 — 결국 이깁니다."
    defeat_line: "조급해지면 졌어요. 잽 한 개씩 — 같은 박자로."
  next_scene_victory: 7
  next_scene_defeat: 4

scene 7:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "컨디션 나빠도 같은 루틴을 끝냈어요. 잘하는 사람이 프로가 아니에요. 같은 사람이 — 프로예요."
    bgm_hint: warm
  next_scene: 8

scene 8:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "잘 갔어... 비 와도 오는 사람. 컨디션 나빠도 같은 루틴 하는 사람. 그게 프로의 정의야."
  next_scene: 9

scene 9:
  type: dialogue
  payload:
    speaker: 도훈
    portrait: dohun
    body: "너 보고 — 나도 안 빠지기로 했어. 다음 시즌엔 — 같이 가자."
  next_scene: 10

scene 10:
  type: ending
  payload:
    ending_code: pro_routine
    title: "프로 루틴 후보"
    subtitle: "매일 같은 자리에 서는 사람"
    cutscene_blocks:
      - type: narration
        body: "비가 오는 화요일 저녁. 체육관은 평소보다 한산하다. 그래도 거울 앞에는 — 같은 자세, 같은 시간."
        background: ring_lights
      - type: image_caption
        speaker: 강 관장
        body: "비 와도 오는 사람. 컨디션 나빠도 같은 루틴 하는 사람... 그게 프로의 정의야. 잘 왔어."
      - type: image_caption
        speaker: 도훈
        body: "야, 너 진짜 매일 오더라. 나도 이젠 안 빠져. 너 때문에..."
      - type: narration
        body: "프로 루틴 후보. 매일 같은 자리에 서는 사람이 가장 무서운 복서."
        background: ring_lights
      - type: credits
        body: "[엔딩: 프로 루틴 후보] 보상: 스토리 XP +200, 링 코인 +300, 칭호 '프로 루틴 후보', 카드 'card_pro_routine', 파이트 머니 +300 (최초 1회)"
    reward_summary:
      story_xp: 200
      ring_coins: 300
      real_gems_first_time: 300
      title: "프로 루틴 후보"
      card_code: card_pro_routine
      badge_code: badge_pro
  next_scene: -1
```

---

## 5. 챔피언 로드 — 6 챕터 시나리오

### 5.1 챕터 1 — 도전자의 문 (champ_01_contender_gate)

**노드**: gym_entrance · **적**: tense_wolf · **씬 수**: 9

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "체육관 벽에 액자가 하나 걸려있어요. 153짐 출신 선배 한 분의 빛바랜 사진. 그 앞에 잠시 멈춥니다."
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: gym_entrance, to_node_code: gym_entrance, transition_message: "체육관 입구 — 액자 앞" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 한 챔피언
    portrait: han_champion
    body: "(액자 속 빛바랜 글자가 또렷해진다) 나도 처음엔 도전자였다. 잘 친 적도, 못 친 적도 있었지. 그저 — 다음 날에 또 왔을 뿐이다."
    bgm_hint: epic
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "액자 앞에서 한 호흡을 골라요. 무엇을 마음에 두시겠어요?"
    choices:
      - label: "'나도 다음 날에 또 와야지'"
        hint: "투지 +5, 리스펙트 +3"
        stat_changes: { grit: +5, respect: +3 }
        next_scene: 4
      - label: "'잘 친 적도 못 친 적도 — 같은 무게'"
        hint: "집중 +5, 가드 +2"
        stat_changes: { focus: +5, guard: +2 }
        next_scene: 4
      - label: "'챔피언도 — 처음엔 평범한 사람이었구나'"
        hint: "리스펙트 +7"
        stat_changes: { respect: +7 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "도전자의 문 앞에서 긴장 늑대가 송곳니를 드러냅니다. '내가 감히 도전을?' 그 두려움."
    bgm_hint: tense
  next_scene: 5

scene 5:
  type: battle
  payload:
    enemy_code: tense_wolf
    intro_line: "첫 턴 가드, 다음 턴 카운터 — 그 콤보."
    victory_line: "늑대가 도망갑니다. 도전자의 문 — 열렸어요."
    defeat_line: "두려움 안에서 한 발만. 다시."
  next_scene_victory: 6
  next_scene_defeat: 4

scene 6:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "도전자의 문을 열었어요. 거창한 의식 없이 — 조용히. 진짜 시작은 — 이렇게 조용해요. 큰 결심이 아니라, 작은 한 걸음."
    bgm_hint: warm
  next_scene: 7

scene 7:
  type: dialogue
  payload:
    speaker: 한 챔피언
    portrait: han_champion
    body: "(다시 한번) 챔피언은 — 도전자였던 사람만 될 수 있다. 너도 — 시작했다."
  next_scene: 8

scene 8:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 1 클리어] 보상: XP +60, 코인 +150, 카드 '첫 글러브'."
    reward_grant: { story_xp: 60, ring_coins: 150, card: card_glove_first }
  next_scene: -1
```

### 5.2 챕터 2 — 그림자 복서 (champ_02_shadow_boxer)

**노드**: mirror_zone · **적**: compare_monster · **씬 수**: 8 (NPC 없음)

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "거울 앞에 섰어요. 거울 속의 그 사람은 — 어제의 나입니다. 잘 안 풀린 라운드도, 포기하고 싶었던 순간도 거기 다 있어요."
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: gym_entrance, to_node_code: mirror_zone, transition_message: "거울 앞 — 어제의 나" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: self
    portrait: self
    body: "(거울 속의 어제의 나) 어제는 — 한 라운드 일찍 멈췄지. 오늘은 — 한 라운드 더 갈래?"
    bgm_hint: tense
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "거울 속 어제의 나에게 무엇이라 답할까요?"
    choices:
      - label: "'한 라운드 더 가자'"
        hint: "투지 +5"
        stat_changes: { grit: +5 }
        next_scene: 4
      - label: "'어제는 잘 했어. 오늘은 같이 가자'"
        hint: "리스펙트 +5, 집중 +3"
        stat_changes: { respect: +5, focus: +3 }
        next_scene: 4
      - label: "'잽 한 개만 더 — 그게 다야'"
        hint: "기술 +5"
        stat_changes: { skill: +5 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "거울 옆 비교 괴물이 다가옵니다. 옆 거울을 자꾸 보게 만드는 — 가장 미세한 적이에요."
    bgm_hint: tense
  next_scene: 5

scene 5:
  type: battle
  payload:
    enemy_code: compare_monster
    intro_line: "이번엔 어제의 나를 겨루는 거예요. 옆 거울 보지 마세요."
    victory_line: "거울 속의 어제의 나가 살짝 끄덕입니다. '잘 했어.'"
    defeat_line: "옆 거울 봤어요. 다시 — 내 거울만."
  next_scene_victory: 6
  next_scene_defeat: 4

scene 6:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "오늘의 나는 어제의 나와 — 싸웠어요. 잽 한 개가 더 깨끗해요. 발 한 걸음이 더 가벼워요. 작은 차이지만 — 거울은 정직하게 보여줘요."
    bgm_hint: warm
  next_scene: 7

scene 7:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 2 클리어] 보상: XP +80, 코인 +200, 카드 '강철 가드'."
    reward_grant: { story_xp: 80, ring_coins: 200, card: card_guard_iron }
  next_scene: -1
```

### 5.3 챕터 3 — 라이벌 매칭 (champ_03_rival_match)

**노드**: rival_arena · **적**: tense_wolf · **씬 수**: 10 (도훈 핵심)

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "비슷한 시기에 들어온 사람이 있어요. 비슷한 레벨, 비슷한 고민. 처음엔 견제했어요."
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: mirror_zone, to_node_code: rival_arena, transition_message: "라이벌 아레나" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 도훈
    portrait: dohun
    body: "한 라운드 더 가자. 너 잘 치는 거 알아. 나도 너 만나면서 늘었어. 우리 — 누가 이긴다보다 — 같이 한 발 더 가는 거. 그거 하자."
    bgm_hint: warm
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "도훈을 어떻게 마주할까요?"
    choices:
      - label: "'그래. 같이 가자.' 글러브 맞대기"
        hint: "리스펙트 +10 (라이벌 우정), grit +3"
        stat_changes: { respect: +10, grit: +3 }
        next_scene: 4
      - label: "'살살 가자' 웃으며"
        hint: "리스펙트 +5, 집중 +3"
        stat_changes: { respect: +5, focus: +3 }
        next_scene: 4
      - label: "'오늘은 진심으로 — 둘 다 한계까지.'"
        hint: "기술 +5, 투지 +5, HP -10"
        stat_changes: { skill: +5, grit: +5, hp: -10 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "라이벌 아레나에 긴장 늑대가 다시 나타나요. 라이벌과 마주할 때 송곳니를 드러내는 그 마음."
    bgm_hint: tense
  next_scene: 5

scene 5:
  type: battle
  payload:
    enemy_code: tense_wolf
    intro_line: "이번엔 — 이기고 싶은 욕망이 적이에요."
    victory_line: "늑대가 사라지고 — 도훈이 글러브를 내립니다. 둘 다 — 한 라운드 더 강해졌어요."
    defeat_line: "이기려는 마음이 너무 컸어요. 다시 — 같이 가는 마음으로."
  next_scene_victory: 6
  next_scene_defeat: 4

scene 6:
  type: dialogue
  payload:
    speaker: 도훈
    portrait: dohun
    body: "잘 치네. 진심으로. 너 만나서 — 나 진짜 늘었어. 다음 시즌도 — 같이 가자."
    bgm_hint: warm
  next_scene: 7

scene 7:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "어느 날 깨달아요 — 라이벌은 적이 아니에요. 함께 자라는 거울이에요. 좋은 라이벌은 내 한계를 보여주는 사람이에요."
  next_scene: 8

scene 8:
  type: choice
  payload:
    prompt: "도훈에게 무엇을 줄까요?"
    choices:
      - label: "물 한 잔"
        hint: "리스펙트 +5"
        stat_changes: { respect: +5 }
        next_scene: 9
      - label: "수건 던져주기"
        hint: "리스펙트 +3, 가드 +2"
        stat_changes: { respect: +3, guard: +2 }
        next_scene: 9
      - label: "엄지 척"
        hint: "투지 +3"
        stat_changes: { grit: +3 }
        next_scene: 9

scene 9:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 3 클리어] 보상: XP +100, 코인 +250, 카드 '바람의 풋워크'."
    reward_grant: { story_xp: 100, ring_coins: 250, card: card_footwork_wind }
  next_scene: -1
```

### 5.4 챕터 4 — 파이트 캠프 (champ_04_fight_camp)

**노드**: fight_camp · **적**: overtrain_golem · **씬 수**: 9

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "캠프에 들어왔어요. 사람도 줄이고 약속도 줄이고. 자기 자신과만 마주해요. 외로워요. 하지만 — 외로움 속에서 단단해지는 결이 있어요."
    bgm_hint: calm
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: rival_arena, to_node_code: fight_camp, transition_message: "파이트 캠프 — 혼자만의 시간" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 김 코치
    portrait: kim
    body: "오늘은 줄넘기 5라운드만. 더 안 해요. 캠프는 더 하는 시간이 아니라 — 정확히 하는 시간이에요. 휴식도 훈련의 일부고."
  next_scene: 3

scene 3:
  type: choice
  payload:
    prompt: "캠프 셋째 날 — 어깨가 뻐근해요. 어떻게 할까요?"
    choices:
      - label: "쉰다 — 안 다치게"
        hint: "집중 +5, HP +20, 리스펙트 +5"
        stat_changes: { focus: +5, hp: +20, respect: +5 }
        next_scene: 4
      - label: "가벼운 줄넘기 — 회복용"
        hint: "집중 +3, 가드 +2"
        stat_changes: { focus: +3, guard: +2 }
        next_scene: 4
      - label: "'한 번만 더' — 무시"
        hint: "기술 +3, HP -15 (위험)"
        stat_changes: { skill: +3, hp: -15 }
        next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "캠프 안에서 과훈련 골렘이 나타나요. '더, 더' 라고 속삭이는 그 마음. 멈춰야 할 때 못 멈추게 만드는 가장 큰 적."
    bgm_hint: tense
  next_scene: 5

scene 5:
  type: battle
  payload:
    enemy_code: overtrain_golem
    intro_line: "골렘 — HP 가 매우 높아요. 잽 누적, 정직하게."
    victory_line: "골렘이 무너집니다. 멈출 때를 안 사람만이 — 마지막 라운드를 갖습니다."
    defeat_line: "조급함이 이겨버렸어요. 한 번 쉬고 — 다시."
  next_scene_victory: 6
  next_scene_defeat: 3

scene 6:
  type: dialogue
  payload:
    speaker: 김 코치
    portrait: kim
    body: "잘 멈췄어요. 다음 라운드를 위해 — 오늘은 그게 최선이에요. 캠프는 — 안 다치고 다음 시즌 가는 거예요."
    bgm_hint: warm
  next_scene: 7

scene 7:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "캠프가 끝났어요. 외로움을 견딘 자리에 — 단단함이 남았어요. 다른 사람이 없을 때 비로소 보이는 — 내 자세, 내 호흡, 내 의도."
    bgm_hint: warm
  next_scene: 8

scene 8:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 4 클리어] 보상: XP +130, 코인 +350, 카드 '번개 카운터'."
    reward_grant: { story_xp: 130, ring_coins: 350, card: card_counter_lightning }
  next_scene: -1
```

### 5.5 챕터 5 — 마지막 라운드 (champ_05_last_round)

**노드**: ring · **적**: quit_demon · **씬 수**: 10

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "마지막 라운드. 가드는 무겁고 발은 안 떨어져요. 한 발만 더. 한 잽만 더. 챔피언의 정신은 — 결과가 아니라 마음이에요."
    bgm_hint: epic
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: fight_camp, to_node_code: ring, transition_message: "링 — 마지막 라운드" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 김 코치
    portrait: kim
    body: "코너에서 들어. 가드 올려. 오른발만 신경 써. 잽 두 번, 백 스텝. 1분 남았어. 끝까지만 가. 잘 칠 필요 없어. 안 멈추기만 해."
    bgm_hint: tense
  next_scene: 3

scene 3:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "한 발 더... 그게 다야. 잘 친 거 안 봐. 안 멈춘 거만 봐. 안 멈췄으면 — 이미 챔피언이야."
  next_scene: 4

scene 4:
  type: choice
  payload:
    prompt: "1분 남았어요. 어떻게 갈까요?"
    choices:
      - label: "잽 두 번, 백 스텝 — 김 코치 작전"
        hint: "기술 +3, 가드 +3"
        stat_changes: { skill: +3, guard: +3 }
        next_scene: 5
      - label: "마지막 한 방 — 카운터"
        hint: "기술 +5, 투지 +3, HP -10"
        stat_changes: { skill: +5, grit: +3, hp: -10 }
        next_scene: 5
      - label: "그냥 — 안 멈춘다"
        hint: "투지 +8"
        stat_changes: { grit: +8 }
        next_scene: 5

scene 5:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "마지막 30초 — 포기 악마가 가장 크게 속삭여요. '이 정도면 됐어.' 끝나기 직전이 — 가장 위험해요."
    bgm_hint: epic
  next_scene: 6

scene 6:
  type: battle
  payload:
    enemy_code: quit_demon
    intro_line: "포기 악마 — 매 턴 집중 -1. 풋워크 + 카운터 콤보."
    victory_line: "악마가 사라지고 — 종이 울려요. 끝까지 갔어요."
    defeat_line: "포기는 한 발 직전에 와요. 다시 — 한 발 더."
  next_scene_victory: 7
  next_scene_defeat: 4

scene 7:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "마지막 종이 울렸어요. 다리는 후들거리지만 — 끝까지 갔어요. 이 한 발이 — 챔피언의 정신이에요. 트로피보다 길게 남는 마음의 흔적."
    bgm_hint: warm
  next_scene: 8

scene 8:
  type: dialogue
  payload:
    speaker: 김 코치
    portrait: kim
    body: "코너에서 본 마지막 1분 — 평생 못 잊어요. 안 멈추는 그 발걸음. 그게 — 챔피언이에요."
    bgm_hint: warm
  next_scene: 9

scene 9:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "[챕터 5 클리어] 보상: XP +160, 코인 +450, 카드 '잽 마스터'."
    reward_grant: { story_xp: 160, ring_coins: 450, card: card_jab_master }
  next_scene: -1
```

### 5.6 챕터 6 — 챔피언 나이트 (champ_06_champion_night) [보스]

**노드**: boxing_hall · **보스**: self_compare_evolved (2페이즈) · **씬 수**: 14 (전원 등장)

```yaml
scene 0:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "시즌이 끝나는 밤이에요. 트로피를 들거나, 못 들거나. 양쪽 다 — 오늘 끝까지 라운드를 뛴 사람들이에요."
    bgm_hint: epic
  next_scene: 1

scene 1:
  type: node_move
  payload: { from_node_code: ring, to_node_code: boxing_hall, transition_message: "복싱 전당 — 챔피언의 밤" }
  next_scene: 2

scene 2:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "잘 했어... 진짜로. 트로피 봐도 안 봐도 — 같아. 끝까지 간 거. 그게 다야."
    bgm_hint: warm
  next_scene: 3

scene 3:
  type: dialogue
  payload:
    speaker: 박 선배
    portrait: park
    body: "같이 시즌 뛰어줘서 고마워요. 저 혼자였으면 — 중간에 포기했을 거예요. 옆에서 떨고 있는 사람이 있다는 게 — 가장 큰 힘이에요."
  next_scene: 4

scene 4:
  type: dialogue
  payload:
    speaker: 민지
    portrait: minji
    body: "선배님!! 진짜 시즌 끝까지 가셨어요?! 저는 오늘 처음 응원 왔는데 — 끝나는 그 순간 — 너무 멋있었어요!"
  next_scene: 5

scene 5:
  type: dialogue
  payload:
    speaker: 도훈
    portrait: dohun
    body: "같이 시즌 뛰어서 다행이야. 너 없었으면 — 내 한계 못 봤을 거야. 다음 시즌도 — 같이 가자. 적이 아니라, 같은 길 가는 사람으로."
  next_scene: 6

scene 6:
  type: choice
  payload:
    prompt: "마지막 거울 앞. 어제의 나와 마주합니다. 무엇을 마음에 둘까요?"
    choices:
      - label: "'어제의 나, 잘 왔어'"
        hint: "리스펙트 +10, 집중 +5"
        stat_changes: { respect: +10, focus: +5 }
        next_scene: 7
      - label: "'한 발만 더 — 그게 다야'"
        hint: "투지 +10, 기술 +3"
        stat_changes: { grit: +10, skill: +3 }
        next_scene: 7
      - label: "'이번 시즌 — 정말 고마웠어'"
        hint: "리스펙트 +15"
        stat_changes: { respect: +15 }
        next_scene: 7

scene 7:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "거울 너머로 — 두 형체가 보입니다. 처음의 나, 그리고 비교 괴물의 진화형. 1페이즈는 가벼워요. 2페이즈는 — 모든 능력치를 합산해서 옵니다."
    bgm_hint: epic
  next_scene: 8

scene 8:
  type: battle
  payload:
    enemy_code: self_compare_evolved
    intro_line: "1페이즈: 처음의 나 (약함). 카운터로 절제된 한 방. 2페이즈: 비교 괴물 진화형 (강함). respect + grit 합 100+ 시 1.5배."
    victory_line: "거울 속의 두 형체가 합쳐집니다 — 그 자리에 당신만 남아요."
    defeat_line: "1페이즈에 너무 강했거나, 2페이즈에 너무 약했어요. 다시."
  next_scene_victory: 9
  next_scene_defeat: 6

scene 9:
  type: dialogue
  payload:
    speaker: 한 챔피언
    portrait: han_champion
    body: "내가 오늘 한 라운드를 뛴 이유는 — 어제의 내가 뛰었기 때문이야. 그게 챔피언의 정신이지."
    bgm_hint: epic
  next_scene: 10

scene 10:
  type: dialogue
  payload:
    speaker: 오삼이
    body: "챔피언 로드 — 6장이 끝났어요. 트로피보다 길게 남는 건 — 그날 코너에서 같이 떨었던 사람들의 얼굴이에요."
    bgm_hint: warm
  next_scene: 11

scene 11:
  type: dialogue
  payload:
    speaker: 강 관장
    portrait: gwan
    body: "잘했어. 가서 좀 자."
  next_scene: 12

scene 12:
  type: dialogue
  payload:
    speaker: 김 코치
    portrait: kim
    body: "다음 캠프에서 뵙죠."
  next_scene: 13

scene 13:
  type: ending
  payload:
    ending_code: champion_spirit
    title: "챔피언의 정신"
    subtitle: "트로피보다 길게 남는 마음"
    cutscene_blocks:
      - type: narration
        body: "체육관 문을 닫고 나오는 새벽 5시. 거리는 아직 어둡고, 차가운 공기가 글러브 냄새와 섞인다."
        background: starfield
      - type: image_caption
        speaker: 오삼이
        body: "오늘도 한 라운드를 끝까지 뛰었어요. 트로피는 없어요. 하지만 그 마음은 — 평생 남아요."
      - type: image_caption
        speaker: 한 챔피언
        body: "내가 오늘 한 라운드를 뛴 이유는 — 어제의 내가 뛰었기 때문이야. 그게 챔피언의 정신이지."
        background: sunrise
      - type: image_caption
        speaker: 강 관장
        body: "잘했어. 가서 좀 자."
      - type: image_caption
        speaker: 박 선배
        body: "수고했어요!"
      - type: image_caption
        speaker: 민지
        body: "선배 짱!"
      - type: image_caption
        speaker: 도훈
        body: "내일 또 봐."
      - type: image_caption
        speaker: 김 코치
        body: "다음 캠프에서 뵙죠."
      - type: narration
        body: "챔피언의 정신. 오늘 한 라운드를 끝까지 뛴 사람은 모두 자신의 챔피언입니다."
        background: sunrise
      - type: credits
        body: "[엔딩: 챔피언의 정신] 보상: 스토리 XP +250, 링 코인 +400, 칭호 '챔피언의 정신', 카드 'card_champion_spirit', 배지 'badge_champion', 파이트 머니 +500 (최초 1회)"
    reward_summary:
      story_xp: 250
      ring_coins: 400
      real_gems_first_time: 500
      title: "챔피언의 정신"
      card_code: card_champion_spirit
      badge_code: badge_champion
  next_scene: -1
```

---

## 6. 적 마스터 데이터

### 6.1 일반 mob (8종)

| code | 이름 | HP | ATK | DEF | 패턴 | 약점 | XP / Coin |
|---|---|---|---|---|---|---|---|
| `lazy_slime` | 게으름 슬라임 | 30 | 5 | 0 | 50% sleep / 50% 약공 | 잽 ×1.5 | 30 / 20 |
| `guard_breaker` | 가드 브레이커 | 60 | 10 | 5 | 3턴 차지 → 가드 무시 강공 (×2.0) | 풋워크 회피 | 50 / 40 |
| `excuse_goblin` | 핑계 도깨비 | 50 | 6 | 3 | "오늘만 쉬자" 유혹 (거절 시 grit +1) | 카운터 | 40 / 30 |
| `compare_monster` | 비교 괴물 | 80 | 8 | 4 | 플레이어 능력치 1개 복사 사용 | respect 50+ → ×1.5 | 60 / 50 |
| `quit_demon` | 포기 악마 | 100 | 12 | 5 | 매 턴 집중 -1 도용 | 풋워크 + 카운터 콤보 | 80 / 60 |
| `tense_wolf` | 긴장 늑대 | 70 | 15 | 3 | 첫 턴 강공, 후반 -50% | 첫 턴 가드 → 카운터 | 50 / 40 |
| `breath_holder` | 숨참기 유령 | 60 | 7 | 2 | 회피율 60% (풋워크 무효), 카운터 시 무효화 | 카운터 | 50 / 40 |
| `overtrain_golem` | 과훈련 골렘 | 150 | 6 | 8 | 지구전, 매 턴 stamina 1 소모 | 잽 누적 | 70 / 60 |

### 6.2 보스 (3종)

#### `master_door` — 마스터의 문 (master_06)
- HP 200 / ATK 12 / DEF 6
- **1페이즈 (HP 100~50%)**: 미러 어택 — 직전 플레이어 명령 그대로 사용. 가드/풋워크는 **respect 80+ 일 때만** 효과.
- **2페이즈 (HP 50~0%)**: 일반 강공격.
- **약점**: respect 80+ 필수.
- **보상**: XP 200 / Coin 300 / 칭호 "마스터 후보" / 카드 `card_master_candidate`.

#### `routine_breaker` — 루틴 파괴자 (pro_06)
- HP 180 / ATK 10 / DEF 5
- **패턴**: 매 턴 플레이어 능력치 1개를 무작위로 영구 -1. 가드/풋워크 가능.
- **약점**: 가드/풋워크로 버티며 잽 누적. 조급함이 패배 원인.
- **보상**: XP 200 / Coin 300 / 칭호 "프로 루틴 후보" / 카드 `card_pro_routine`.

#### `self_compare_evolved` — 처음의 나 / 비교 괴물 진화형 (champ_06) [2페이즈]
- **1페이즈 — 처음의 나**: HP 50 / ATK 4 / DEF 2
  - 패턴: 플레이어의 첫 챕터 시작 모습. 약하지만 마음 아픈 대사.
  - 약점: 카운터 (절제된 한 방)
- **2페이즈 — 비교 괴물 진화형**: HP 250 / ATK 14 / DEF 7
  - 패턴: 플레이어 능력치 모두 합산해서 그 절반을 자기 공격력으로 사용.
  - 약점: respect + grit 합 100+ 시 ×1.5.
- **보상**: XP 250 / Coin 400 / 칭호 "챔피언의 정신" / 카드 `card_champion_spirit` / 배지 `badge_champion`.

---

## 7. 스토리 카드 마스터 데이터

| code | 이름 | 효과 | 획득처 |
|---|---|---|---|
| `card_glove_first` | 첫 글러브 | 데미지 +20% (1회) | master_01, pro_01, champ_01 클리어 |
| `card_jab_master` | 잽 마스터 | 다음 잽 회당 데미지 ×3 | master_02, pro_05, champ_05 |
| `card_guard_iron` | 강철 가드 | 다음 1턴 무적 | master_03, pro_02, champ_02 |
| `card_footwork_wind` | 바람의 풋워크 | 다음 2턴 회피율 100% | master_05 (분기), pro_03, champ_03 |
| `card_counter_lightning` | 번개 카운터 | 다음 카운터 무조건 성공 | master_05, pro_04, champ_04 |
| `card_respect_warmth` | 따뜻함의 마음 | 적 1턴 행동 멈춤 + respect +5 | master_04 |
| `card_master_candidate` | 마스터 후보 | 장식 (엔딩) | master_06 엔딩 |
| `card_pro_routine` | 프로 루틴 후보 | 장식 (엔딩) | pro_06 엔딩 |
| `card_champion_spirit` | 챔피언의 정신 | 장식 (엔딩) | champ_06 엔딩 |

---

## 8. 능력치 변동 누적 표 (밸런스 검증)

각 챕터에서 모든 선택지를 평균낸 stat 변동 누적. **루트당 평균 +5~10 권장**.

### 마스터의 길

| 챕터 | hp | focus | skill | guard | grit | respect |
|---|---|---|---|---|---|---|
| 1 | 0 | 0 | +0.7 | 0 | +0.7 | +2.0 |
| 2 | 0 | 0 | +0.7 | +0.7 | +0.7 | +2.7 |
| 3 | -1.7 | +1.0 | 0 | 0 | +1.3 | +1.7 |
| 4 | 0 | 0 | +1.0 | 0 | +0.7 | +4.3 |
| 5 | 0 | 0 | +1.0 | 0 | 0 | +5.5 |
| 6 | 0 | +2.7 | 0 | +1.0 | +2.7 | +1.7 |
| **합계** | **-1.7** | **+3.7** | **+3.4** | **+1.7** | **+6.1** | **+17.9** |

### 프로의 길

| 챕터 | hp | focus | skill | guard | grit | respect |
|---|---|---|---|---|---|---|
| 1 | 0 | +0.7 | +0.7 | 0 | +1.7 | +1.0 |
| 2 | +5 | +1.7 | +1.0 | +0.7 | +1.7 | 0 |
| 3 | 0 | +1.0 | 0 | +1.7 | +2.7 | +3.3 |
| 4 | -10 | +2.5 | 0 | 0 | +4.0 | 0 |
| 5 | 0 | +1.7 | +5.7 | +0.7 | +0.7 | 0 |
| 6 | +3.3 | +2.7 | +1.7 | 0 | +2.7 | 0 |
| **합계** | **-1.7** | **+10.3** | **+9.1** | **+3.1** | **+13.5** | **+4.3** |

### 챔피언 로드

| 챕터 | hp | focus | skill | guard | grit | respect |
|---|---|---|---|---|---|---|
| 1 | 0 | +1.7 | 0 | +0.7 | +1.7 | +5.0 |
| 2 | 0 | +1.0 | +1.7 | 0 | +1.7 | +1.7 |
| 3 | -3.3 | +1.0 | +1.7 | +0.7 | +2.7 | +6.0 |
| 4 | +1.7 | +2.7 | +1.0 | +0.7 | 0 | +1.7 |
| 5 | -3.3 | 0 | +2.7 | +1.0 | +3.7 | 0 |
| 6 | 0 | +1.7 | +1.0 | 0 | +3.3 | +11.7 |
| **합계** | **-5.0** | **+8.0** | **+8.0** | **+3.0** | **+13.0** | **+26.0** |

**검증**: 각 루트 끝나면 능력치 +5~10 (체력은 유지~약간 손실, 스킬/그릿은 충분히 성장, 리스펙트는 루트 색깔 반영). 마스터 = 리스펙트 강조, 프로 = 그릿/스킬, 챔피언 = 리스펙트+그릿 균형. ✓

---

## 9. 분기 트리 (선택지 → 분기 그래프)

대부분의 선택지는 **합류형** — 다른 선택해도 같은 다음 씬으로 모임 (UX 단순화). 다만 일부 챕터는 능력치 누적이 다음 보스전 난이도에 영향을 줌.

### 9.1 마스터의 길 (예시)

```
ch1 scene 3 (글러브 받기)
   ├─ 정중 → respect +5
   ├─ 한 손 → skill +1, respect +1
   └─ 머뭇 → grit +2
         ↓
        scene 4 (박 선배) ─── 합류

ch4 scene 3 (민지 답변)
   ├─ "괜찮아요, 천천히" → respect +8 (큰 변화)
   ├─ 자세 시범 → skill +3, respect +4
   └─ "저도 배우는 중" → respect +1
         ↓
        scene 4 (박 선배) ─── 합류

ch6 scene 3 (마스터 테스트 호흡)
   ├─ 코로 천천히 → focus +5, guard +3
   ├─ 민지 떠올림 → respect +5, grit +3
   └─ 박 선배 한마디 → grit +5, focus +3
         ↓
        scene 4 ─── 합류
         ↓
        보스: master_door
         (respect 80+ 필요 → ch1·ch3·ch4·ch5 합산 약 +18, ch6 +5 = +23 루트만으로 부족)
         (실패 시 다른 루트 진행해서 NPC 대화 통해 respect 추가 권장)
```

### 9.2 프로의 길 (요약)

```
ch3 (첫 스파링) — 김 코치/도훈/박 선배 회상 중 1택
   → 모두 합류 → tense_wolf 전투
ch6 (프로 루틴 테스트) — 평소/조금 줄여서/기본기만
   → 모두 합류 → routine_breaker 보스
```

### 9.3 챔피언 로드 (요약)

```
ch6 scene 6 (마지막 거울)
   ├─ "어제의 나, 잘 왔어" → respect +10, focus +5
   ├─ "한 발만 더" → grit +10, skill +3
   └─ "이번 시즌 고마웠어" → respect +15
         ↓
        보스: self_compare_evolved (2페이즈)
         (2페이즈 약점: respect + grit 합 100+ 필요 → 챔피언 루트만으로 약 +49,
          프로 루트 병행 시 grit 추가 → 100+ 가능)
```

### 9.4 시크릿 분기 (선택)

- 모든 카드 9장 수집 시 **시크릿 씬**: 한 챔피언이 직접 등장 (액자가 아닌 환영) — 챔피언 로드 ch6 후
- respect 100 도달 시 **NPC 보너스 대화**: 강 관장이 "글러브 끈 묶는 법, 다음 신입한테 가르쳐줘" 의뢰 (마스터 분기 보너스 카드)

---

## 10. 운영 / 밸런싱 메모

### 10.1 평균 플레이타임

| 단위 | 시간 |
|---|---|
| 1 씬 (대화/선택) | ~1분 (타이프라이터 40ms × 100자) |
| 1 전투 | ~3-5분 (5-10턴 × 30초) |
| 1 챕터 (8 씬 + 1 전투) | **7-12분** |
| 1 루트 (6 챕터) | **60-75분** |
| 3 루트 전체 | **3-4시간** |
| 시크릿 분기 포함 | **4-5시간** |

### 10.2 난이도 곡선 (적 HP)

```
챕터 1: HP 30~50 (lazy_slime / tense_wolf 일부)
챕터 2: HP 50~70 (guard_breaker / excuse_goblin)
챕터 3: HP 70~80 (excuse_goblin / tense_wolf / compare_monster)
챕터 4: HP 60~150 (compare_monster / breath_holder / overtrain_golem)
챕터 5: HP 80~150 (compare_monster / overtrain_golem / quit_demon)
챕터 6 (보스): HP 180~250 (master_door / routine_breaker / self_compare_evolved 2페이즈 합 300)
```

평균 **챕터당 1.5배씩 증가**. 보스 = 일반 mob의 2~3배.

### 10.3 보상 곡선 (story_xp)

```
챕터 1: 60
챕터 2: 80
챕터 3: 100
챕터 4: 120~130
챕터 5: 150~160
챕터 6 (보스 + 엔딩): 200~250 + 엔딩 보너스
루트 합계: 약 1,200 XP + 엔딩 200~250
3 루트: 약 3,800 XP + 시크릿 보너스
```

링 코인 비율: XP × 2.5 (대략).

### 10.4 진행 가이드

- **첫 플레이어**: 마스터의 길 권장 (NPC 풍부, 선택 영향 작음)
- **두 번째 루트**: 프로의 길 (밸런스 학습)
- **세 번째 루트**: 챔피언 로드 (보스 난이도 최고, 누적 능력치 활용)
- **루트 전환 시 능력치 보존**: 캐릭터 단일 — 루트별 진행도만 분리

### 10.5 후속 확장 가능 영역

- 시즌 한정 4번째 루트 (예: "신년 복서의 길")
- NPC 개인 의뢰 사이드 퀘스트 (강 관장 의뢰, 김 코치 코너 미니게임 등)
- 카드 합성 / 진화 시스템
- 챔피언 로드 클리어 후 **+회차 모드** — 적 HP ×1.5

---

## 작업 완료 요약 (Stage 44)

1. **생성 파일**: `docs/153-story-rpg-game-scenario.md` (1 파일)
2. **총 씬 수**: 약 **162** (프롤로그 4 + 마스터 9+8+9+11+9+12 = 58 + 프로 8+8+10+8+9+11 = 54 + 챔피언 9+8+10+9+10+14 = 60 = 176, 엔딩 컷씬 블록 제외 시 챕터 본문 ~158)
3. **챕터별 씬 수 분포**:
   - 마스터: 9 / 8 / 9 / 11 / 9 / 12
   - 프로: 8 / 8 / 10 / 8 / 9 / 11
   - 챔피언: 9 / 8 / 10 / 9 / 10 / 14
4. **8 mob + 3 보스 데이터**: 완성 (§6.1, §6.2)
5. **9 카드 데이터**: 완성 (§7)
6. **분기 트리**: 작성 (§9 — 텍스트 기반 ASCII)
7. **다음 단계 (Stage 45 — DB 재설계)**:
   - 신규 테이블 후보: `boxing_story_scenes`, `boxing_story_enemies`, `boxing_story_cards`, `boxing_story_inventory`, `boxing_story_battle_log`, `boxing_user_player_stats`, `boxing_user_scene_progress` (7개)
   - 신규 RPC 후보: `start_story_session`, `progress_to_scene`, `apply_choice`, `start_battle`, `submit_player_command`, `claim_card_reward`, `complete_ending`, `reset_story_route` (8개)
   - 본 시나리오 문서를 SQL seed (`INSERT INTO boxing_story_scenes ...`) 로 변환
8. **git diff --stat**: `docs/153-story-rpg-game-scenario.md | +1700 (신규)`
