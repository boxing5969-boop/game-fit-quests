# 153 스토리 RPG — Claude Code 실행 프롬프트 (단계 33~40)

> **사용법**: 각 단계의 코드 블록을 Claude Code 에 그대로 복사 → 붙여넣기 → 실행.
>
> 단계는 **순서대로** 진행. 한 단계가 끝나면 빌드/푸시 확인 후 다음 단계 시작.
>
> 모든 단계의 핵심 원칙: **공식 1~40레벨 시스템(levels, missions, member_progress, mastertrack, MissionsPage, RankUpPage, ChatAssistant, /challenges 21일, allLevelsData, whiteLevel1Data, sharedConstants 공식 훈련 데이터)은 절대 수정 금지.**

---

## 진행 흐름 한눈에

| 단계 | 작업 | 출력 |
|---|---|---|
| 33 | 설계 / 충돌 분석 (코드 X) | `docs/153-story-rpg-plan.md` |
| 34 | DB/RPC 기반 구축 | migration + RPCs + seed |
| 35 | 서비스/훅/정적 데이터 | service + hook + types |
| 36 | 메뉴/라우트/기본 페이지 | `/story-rpg` + 진입 카드 |
| 37 | 3가지 서사 선택 + 챕터 | route 선택 + 진행도 |
| 38 | 월드맵 + 오삼이 대화창 | 노드 + 대화 + 캐릭터 |
| 39 | QUEST 활동 연결 + 보상 | progress sync + claim |
| 40 | QA + 회귀 + 빌드 검증 | `docs/153-story-rpg-qa-regression-report.md` |

---

## 단계 33 — 153 스토리 RPG 설계 / 충돌 분석

> 코드 구현 안 함. 문서만 작성.

```
너는 지금부터 마이복서153 앱 안에 "153 스토리 RPG" 게임 모드를 추가하기 위한 시니어 제품 설계자이자 코드베이스 안전 점검자다.

이번 작업은 33단계다.
목표는 기능 구현이 아니라 "153 스토리 RPG"의 구조 설계, 기존 시스템과의 분리, 충돌 가능성 분석, 구현 계획 문서 작성이다.

이번 단계에서는 코드 구현을 하지 마라.
DB migration을 만들지 마라.
React 컴포넌트를 만들지 마라.
RPC를 만들지 마라.
문서만 작성하라.

생성할 문서:
docs/153-story-rpg-plan.md

기능 정의:
"153 스토리 RPG"는 마이복서153 앱 안에 새로 추가되는 별도 게임 모드다.
기존 공식 1~40레벨 마스터로드, 공식 훈련, 공식 미션 제출, 코치 승인, 보스전, 승급 구조를 변경하지 않는다.
기존 캐릭터와 기존 활동 데이터를 읽어서 RPG처럼 보여주는 보조 게임 모드다.

메뉴명: 153 스토리 RPG
화면 제목: 복서의 길

핵심 컨셉:
회원은 체육관에 처음 온 신입 회원으로 시작한다.
이후 3가지 복서의 길 중 하나를 선택한다.

1. 마스터의 길 — 회원에서 복싱 지도자 후보로 성장하는 서사
2. 프로의 길 — 회원에서 프로복서 루틴 후보로 성장하는 서사
3. 챔피언 로드 — 회원에서 챔피언의 정신을 완성하는 서사

벤치마크 감성:
레트로 RPG식 월드맵, 대화창, 챕터 노드, NPC 대화, 퀘스트 클리어 연출.
단, 환세취호전의 캐릭터, 스토리, 명칭, 이미지, 설정은 절대 사용하지 않는다.
구조적 재미만 참고하고 모든 세계관은 마이복서153 자체 세계관으로 만든다.

가장 중요한 보호 원칙:
1. 공식 1~40레벨 훈련 리스트는 수정하지 않는다.
2. levels, missions, mission_videos, mission_submissions, member_progress는 수정하지 않는다.
3. 공식 XP와 QUEST XP는 계속 분리한다.
4. 스토리 RPG는 공식 레벨업, 승급, 보스전 조건에 직접 영향을 주면 안 된다.
5. 스토리 RPG는 공식 미션을 자동 완료하지 않는다.
6. 스토리 RPG는 공식 보스전을 자동 통과시키지 않는다.
7. member_progress.total_xp를 update 하지 않는다.
8. 파이트 머니는 직접 update 하지 않고 기존 grant_gems 또는 서버 검증 RPC를 통해서만 지급한다.
9. 기존 ChatAssistant 외에 새 AI 챗봇을 만들지 않는다.
10. 오삼이 대화는 정적 스토리 대사 또는 데이터 카드로만 구현한다.
11. 기존 /challenges 21일 챌린지와 충돌하지 않는다.
12. 실존 복서, 영화, 만화, 실제 명언, 경기 영상은 seed 데이터에 넣지 않는다.

절대 수정 금지:
- levels
- missions
- mission_videos
- mission_submissions
- member_progress
- approve_mission_submission
- record_attendance
- useManualLevelUp
- usePassBossBattle
- MissionsPage
- RankUpPage
- ChatAssistant
- supabase/functions/chat-assistant
- 기존 /challenges 21일 챌린지
- challengeService
- useWallet
- allLevelsData
- whiteLevel1Data
- sharedConstants의 공식 훈련 데이터

먼저 확인할 파일/영역:
- src/App.tsx
- src/components/BottomNav.tsx 또는 현재 메뉴/네비게이션 컴포넌트
- src/pages/HomePage.tsx
- src/pages/MyPage.tsx
- src/pages/CharacterStudioPage.tsx
- src/pages/RankUpPage.tsx
- src/pages/MissionsPage.tsx
- src/components/engagement/*
- src/hooks/useBoxingEngagement.ts
- src/services/boxingEngagementService.ts
- src/contexts/AuthContext.tsx
- supabase/migrations 중 boxing engagement 관련 migration

설계할 내용:

1. 새 메뉴 삽입 방식
- 메뉴명: 153 스토리 RPG
- route 후보: /story-rpg
- 화면 제목: 복서의 길
- 하단 메뉴가 너무 많으면 HomePage 카드 + MyPage 카드 + 별도 route로 시작하고, BottomNav 추가는 안전성 검토 후 결정한다.

2. 3가지 서사 구조

A. 마스터의 길
- 첫 글러브
- 기본기의 벽
- 반복의 방
- 후배의 등장
- 지도자의 눈
- 마스터 테스트

B. 프로의 길
- 취미반의 시작
- 루틴의 탄생
- 첫 스파링의 긴장
- 체력의 벽
- 나의 스타일
- 프로 루틴 테스트

C. 챔피언 로드
- 도전자의 문
- 그림자 복서
- 라이벌 매칭
- 파이트 캠프
- 마지막 라운드
- 챔피언 나이트

3. RPG 월드맵 노드
- 체육관 입구
- 거울 앞
- 줄넘기 존
- 샌드백 존
- 링
- 코너
- 복싱 전당
- 마스터룸
- 파이트 캠프
- 라이벌 아레나

4. 적/장애물은 사람이 아니라 나쁜 습관으로 표현
- 게으름 슬라임
- 가드 브레이커
- 숨참기 유령
- 손목꺾임 괴물
- 포기 악마
- 핑계 도깨비
- 긴장 늑대
- 비교 괴물
- 과훈련 골렘

5. 기존 기능과 연결할 활동 데이터
- 복싱 IQ 퀴즈
- 재미 챌린지
- 챔피언 일기
- 세컨드 응원
- 컨디션 게이지
- 리턴 라운드
- 숨겨진 미션
- 그림자 복서
- 코너맨
- 짐 레이드
- 시즌 파이트 캠프
- 카드 수집
- 라이벌 시즌
- 블랙 트레이너
- 오삼이 라디오

단, 존재하지 않는 기능이 있으면 graceful fallback으로 처리한다.

6. 보상 구조
스토리 RPG 보상은 공식 XP가 아니다.
보상 후보:
- QUEST XP
- 파이트 머니
- 스토리 카드
- 칭호
- 프로필 프레임
- RPG 챕터 진행도
- 복싱 전당 전시

7. 필요한 DB/RPC 후보 (문서에만 제안. migration 안 만든다.)

후보 테이블:
- boxing_story_routes
- boxing_story_chapters
- boxing_story_nodes
- boxing_story_dialogues
- boxing_user_story_progress
- boxing_story_reward_claims

후보 RPC:
- get_my_story_rpg_state
- choose_story_route
- sync_story_chapter_progress
- claim_story_chapter_reward
- change_story_route

문서 구조:
# 153 스토리 RPG 구현 계획

1. 기능 정의
2. 기존 시스템과 분리되는 구조
3. 공식 1~40레벨 보호 원칙
4. 3가지 서사 구조
5. 월드맵 노드 구조
6. RPG 대화창 구조
7. 기존 QUEST 활동과 연결 방식
8. 보상 구조
9. DB/RPC 후보
10. UI 삽입 위치
11. 기존 파일과 충돌 가능성
12. 충돌 방지 전략
13. 단계별 구현 순서
14. QA 체크리스트
15. 보류 기능과 후속 확장

작업 완료 후 출력:
1. 생성/수정한 문서 파일 경로
2. 153 스토리 RPG 핵심 구조 요약
3. 공식 시스템 보호 전략
4. 필요한 DB/RPC 후보
5. 필요한 컴포넌트 후보
6. 다음 34단계에서 할 작업
7. git diff --stat 결과

이번 단계에서는 docs/153-story-rpg-plan.md 외에는 수정하지 않는 것을 원칙으로 하라.
```

### 33단계 후 검증

```powershell
git status -sb
```

```powershell
git diff --stat
```

문서 1개만 변경되어야 정상.

```powershell
git add docs/153-story-rpg-plan.md
git commit -m "docs(story-rpg): 153 스토리 RPG 설계 + 충돌 분석 (33단계)"
git push origin main
```

---

## 단계 34 — DB/RPC 기반 구축

> Migration + 신규 테이블 + RPC + seed. UI 손대지 않음.

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG"를 위한 DB/RPC 기반을 구현하는 시니어 Supabase/Postgres 개발자다.

이번 작업은 34단계다.
목표는 153 스토리 RPG 전용 테이블, RLS, seed 데이터, RPC를 추가하는 것이다.

이번 단계에서는 UI를 만들지 마라.
React 컴포넌트를 만들지 마라.
HomePage, MyPage, App.tsx, BottomNav를 수정하지 마라.
공식 1~40레벨 훈련 리스트를 절대 수정하지 마라.

절대 수정 금지:
- levels
- missions
- mission_videos
- mission_submissions
- member_progress
- approve_mission_submission
- record_attendance
- useManualLevelUp
- usePassBossBattle
- MissionsPage
- RankUpPage
- ChatAssistant
- supabase/functions/chat-assistant
- 기존 /challenges 21일 챌린지
- challengeService
- useWallet
- allLevelsData
- whiteLevel1Data
- sharedConstants의 공식 훈련 데이터
- src/integrations/supabase/types.ts 직접 수동 수정 금지

허용되는 작업:
- 새 Supabase migration 파일 추가
- 새 테이블 추가
- 새 RLS 정책 추가
- 새 RPC 추가
- 스토리 RPG seed 데이터 추가
- docs에 DB 적용 안내 추가 가능

먼저 할 일:
1. supabase/migrations 폴더의 마지막 migration 파일명을 확인하라.
2. 새 migration 파일명은 기존 마지막 파일보다 뒤의 단조 증가 timestamp로 만든다.
3. 기존 grant_gems RPC 시그니처를 확인하라.
4. 기존 boxing_engagement_profiles / boxing_engagement_events가 있는지 확인하라.
5. 기존 RLS 패턴을 확인하라.
6. 기존 has_role / is_branch_manager_of helper가 있다면 시그니처를 확인하라.

새 migration 파일명 예시:
YYYYMMDDHHMMSS_boxing_story_rpg_foundation.sql
실제 현재 마지막 migration을 기준으로 단조 증가하게 생성하라.

신규 테이블:

1. boxing_story_routes
- id uuid primary key default gen_random_uuid()
- code text not null unique
- title text not null
- subtitle text
- description text not null
- route_type text not null  -- master | pro | champion
- sort_order integer not null default 0
- active boolean not null default true
- metadata jsonb not null default '{}'::jsonb
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

2. boxing_story_chapters
- id uuid primary key default gen_random_uuid()
- route_id uuid not null references boxing_story_routes(id) on delete cascade
- code text not null unique
- chapter_number integer not null
- title text not null
- subtitle text
- description text not null
- world_node_code text not null
- obstacle_code text
- unlock_condition jsonb not null default '{}'::jsonb
- completion_condition jsonb not null default '{}'::jsonb
- reward_quest_xp integer not null default 0
- reward_gems integer not null default 0
- reward_title text
- reward_card_code text
- active boolean not null default true
- metadata jsonb not null default '{}'::jsonb
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
- unique(route_id, chapter_number)

3. boxing_story_nodes
- id uuid primary key default gen_random_uuid()
- code text not null unique
- title text not null
- description text not null
- node_type text not null  -- gym | mirror | rope | sandbag | ring | corner | hall | master_room | camp | rival_arena
- icon text
- sort_order integer not null default 0
- active boolean not null default true
- metadata jsonb not null default '{}'::jsonb
- created_at timestamptz not null default now()

4. boxing_story_dialogues
- id uuid primary key default gen_random_uuid()
- route_id uuid references boxing_story_routes(id) on delete cascade
- chapter_id uuid references boxing_story_chapters(id) on delete cascade
- speaker text not null default '오삼이'
- dialogue_type text not null default 'intro'  -- intro | progress | complete | locked | reward | boss
- body text not null
- choices jsonb not null default '[]'::jsonb
- sort_order integer not null default 0
- active boolean not null default true
- metadata jsonb not null default '{}'::jsonb
- created_at timestamptz not null default now()

5. boxing_user_story_progress
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references auth.users(id) on delete cascade
- route_id uuid not null references boxing_story_routes(id) on delete cascade
- current_chapter_id uuid references boxing_story_chapters(id) on delete set null
- current_chapter_number integer not null default 1
- completed_chapter_count integer not null default 0
- route_completed boolean not null default false
- selected_at timestamptz not null default now()
- last_synced_at timestamptz
- metadata jsonb not null default '{}'::jsonb
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
- unique(user_id, route_id)

회원이 루트를 바꿀 수 있도록 여러 route progress를 보유 가능.

6. boxing_user_story_route_state
- user_id uuid primary key references auth.users(id) on delete cascade
- active_route_id uuid references boxing_story_routes(id) on delete set null
- updated_at timestamptz not null default now()
- created_at timestamptz not null default now()

7. boxing_story_reward_claims
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references auth.users(id) on delete cascade
- route_id uuid not null references boxing_story_routes(id) on delete cascade
- chapter_id uuid not null references boxing_story_chapters(id) on delete cascade
- quest_xp_granted integer not null default 0
- gems_granted integer not null default 0
- reward_title text
- reward_card_code text
- claimed_at timestamptz not null default now()
- metadata jsonb not null default '{}'::jsonb
- unique(user_id, chapter_id)

RLS:
- active routes/chapters/nodes/dialogues는 로그인 회원 SELECT 가능
- user progress/state/reward claims는 본인만 SELECT 가능
- insert/update는 RPC로만
- 관리자/코치는 필요 시 SELECT 가능
- 직접 보상 insert 금지

Seed 데이터:

A. story routes 3개
1. master_path
title: 마스터의 길
subtitle: 회원에서 복싱 지도자 후보로
description: 기본기를 익히고 후배를 도울 수 있는 복싱 리더로 성장하는 서사입니다.
route_type: master

2. pro_path
title: 프로의 길
subtitle: 회원에서 프로복서 루틴 후보로
description: 취미로 시작해 선수처럼 루틴을 완성하는 도전 서사입니다.
route_type: pro

3. champion_road
title: 챔피언 로드
subtitle: 회원에서 챔피언의 정신으로
description: 어제의 나와 겨루고 시즌을 완주하며 챔피언의 정신을 완성하는 서사입니다.
route_type: champion

B. story nodes 10개
- gym_entrance: 체육관 입구
- mirror_zone: 거울 앞
- rope_zone: 줄넘기 존
- sandbag_zone: 샌드백 존
- ring: 링
- corner: 코너
- boxing_hall: 복싱 전당
- master_room: 마스터룸
- fight_camp: 파이트 캠프
- rival_arena: 라이벌 아레나

C. chapters 18개

마스터의 길:
1. master_01_first_glove: 첫 글러브
2. master_02_basic_wall: 기본기의 벽
3. master_03_repeat_room: 반복의 방
4. master_04_new_member: 후배의 등장
5. master_05_trainer_eye: 지도자의 눈
6. master_06_master_test: 마스터 테스트

프로의 길:
1. pro_01_hobby_start: 취미반의 시작
2. pro_02_routine_birth: 루틴의 탄생
3. pro_03_first_spar_tension: 첫 스파링의 긴장
4. pro_04_stamina_wall: 체력의 벽
5. pro_05_my_style: 나의 스타일
6. pro_06_pro_routine_test: 프로 루틴 테스트

챔피언 로드:
1. champ_01_contender_gate: 도전자의 문
2. champ_02_shadow_boxer: 그림자 복서
3. champ_03_rival_match: 라이벌 매칭
4. champ_04_fight_camp: 파이트 캠프
5. champ_05_last_round: 마지막 라운드
6. champ_06_champion_night: 챔피언 나이트

D. dialogue seed
각 챕터 intro 최소 1개씩.
실존 복서/영화/만화/실제 명언 금지.
오삼이 자체 대사만 사용.

예시:
"처음 글러브를 낀 날, 모든 동작은 어색합니다. 하지만 복싱은 완벽한 시작이 아니라 반복으로 만들어집니다."
"오늘의 상대는 남이 아닙니다. 어제의 나입니다."
"지도자의 눈은 남을 평가하는 눈이 아니라, 안전하게 성장하도록 돕는 눈입니다."

필요 RPC:

1. get_my_story_rpg_state()
반환:
- routes
- active_route
- progress
- current_chapter
- chapters
- nodes
- dialogues
- available_rewards
- user official rank/level read-only summary, 가능하면 기존 member_progress 읽기만

2. choose_story_route(p_route_code text)
- auth.uid() 확인
- route active 확인
- user route state update
- progress 없으면 생성
- 첫 챕터를 current로 설정
- 공식 XP/member_progress 수정 금지

3. change_story_route(p_route_code text)
choose_story_route와 유사. 기존 진행도 삭제하지 않음. active route만 변경.

4. sync_story_chapter_progress(p_route_code text)
- auth.uid() 확인
- 기존 QUEST 활동 데이터를 읽어 completion_condition 충족 여부 계산
- 조건 충족한 챕터 수 업데이트
- current_chapter_number 업데이트
- route_completed 계산
- 공식 XP/member_progress 수정 금지

읽을 수 있는 데이터:
- boxing_quiz_attempts
- boxing_fun_challenge_attempts
- champion_journal_entries
- boxing_cheers
- boxing_hidden_mission_claims (있으면)
- boxing_shadow_boxer_claims (있으면)
- boxing_rival_matches / weekly_scores (있으면)
- boxing_season_progress (있으면)
- boxing_user_collectible_cards (있으면)
- boxing_engagement_profiles

존재하지 않는 테이블은 참조하지 않도록 실제 schema 확인 후 안전하게 작성하라.

5. claim_story_chapter_reward(p_chapter_id uuid)
- auth.uid() 확인
- chapter completion_condition 충족 확인
- 이미 claim했으면 보상 0
- boxing_story_reward_claims insert
- boxing_engagement_events insert
- boxing_engagement_profiles 업데이트
- gems는 grant_gems RPC 경유
- 공식 XP 지급 금지

보상:
각 챕터:
- QUEST XP +50~200
- 파이트 머니 +100~500
- reward_title optional
- reward_card_code optional

중복 보상 방지:
- unique(user_id, chapter_id)
- boxing_engagement_events idempotency_key 병행 가능

공식 시스템 보호:
migration 안에서 아래 금지:
- update member_progress
- update missions
- update levels
- approve_mission_submission 호출
- record_attendance 호출

작업 완료 후 출력:
1. 생성한 migration 파일명
2. 생성한 테이블 목록
3. 생성한 RPC 목록
4. seed 데이터 요약
5. 공식 시스템 보호 방식
6. Supabase SQL Editor에서 실행할 순서
7. 확인 SQL
8. git diff --stat 결과
```

### 34단계 후 검증 + Supabase 실행

```powershell
git status -sb
git diff --name-only | Select-String "supabase/migrations"
```

migration 파일 확인 후 Supabase Dashboard 에 수동 실행:

```powershell
Get-Content ".\supabase\migrations\YYYYMMDDHHMMSS_boxing_story_rpg_foundation.sql" -Raw | Set-Clipboard
```

(파일명은 실제 생성된 것으로 교체)

브라우저에서:
- https://supabase.com/dashboard/project/raoqefkwdpovwlgbibis
- SQL Editor → New query → Ctrl+V → Run

확인 SQL (Supabase SQL Editor 에서):

```sql
select
  to_regclass('public.boxing_story_routes')         as routes,
  to_regclass('public.boxing_story_chapters')        as chapters,
  to_regclass('public.boxing_story_nodes')           as nodes,
  to_regclass('public.boxing_story_dialogues')       as dialogues,
  to_regclass('public.boxing_user_story_progress')   as user_progress,
  to_regclass('public.boxing_user_story_route_state') as route_state,
  to_regclass('public.boxing_story_reward_claims')   as reward_claims;

select proname from pg_proc
where proname in (
  'get_my_story_rpg_state',
  'choose_story_route',
  'change_story_route',
  'sync_story_chapter_progress',
  'claim_story_chapter_reward'
)
order by proname;

select count(*) as route_count    from public.boxing_story_routes;
select count(*) as chapter_count  from public.boxing_story_chapters;
select count(*) as node_count     from public.boxing_story_nodes;
select count(*) as dialogue_count from public.boxing_story_dialogues;
```

기대값: routes 3 / chapters 18 / nodes 10 / dialogues ≥18

```powershell
git add supabase/migrations docs
git commit -m "feat(story-rpg): DB/RPC 기반 구축 (34단계) — boxing_story_* 7테이블 + 5 RPCs + seed"
git push origin main
```

---

## 단계 35 — 서비스/훅/정적 데이터 연결

> 페이지 UI 미구현. service/hook/types/data 만 추가.

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG" 프론트 데이터 레이어를 구현하는 시니어 프론트엔드 개발자다.

이번 작업은 35단계다.
목표는 34단계에서 만든 DB/RPC를 프론트에서 안전하게 사용할 수 있도록 service, hook, data 파일을 추가하는 것이다.

이번 단계에서는 페이지 UI를 완성하지 마라.
HomePage, MyPage, App.tsx, BottomNav를 크게 수정하지 마라.
공식 1~40레벨 훈련 리스트를 절대 수정하지 마라.

절대 수정 금지:
- levels
- missions
- mission_videos
- mission_submissions
- member_progress
- MissionsPage
- RankUpPage
- ChatAssistant
- 기존 /challenges 21일 챌린지
- challengeService
- useWallet
- allLevelsData
- whiteLevel1Data
- sharedConstants의 공식 훈련 데이터
- src/integrations/supabase/types.ts 직접 수동 수정 금지

전제:
34단계 migration이 운영 DB에 반영되었다고 가정한다.
types.ts가 아직 갱신되지 않았다면, 기존 프로젝트의 타입 우회 패턴 (`as unknown as ...` / `from(... as never)`) 을 좁게 사용하되, types.ts를 수동 작성하지 마라.

추가할 파일:
- src/services/storyRpgService.ts
- src/hooks/useStoryRpg.ts
- src/data/storyRpgCopy.ts
- src/data/storyRpgVisuals.ts
- src/types/storyRpg.ts

query key (기존 challenges/wallet/diet와 충돌 방지):
- ["story-rpg", user?.id]
- ["story-rpg", "routes", user?.id]
- ["story-rpg", "progress", user?.id]
- ["story-rpg", "state", user?.id]

구현할 service 함수:

1. getMyStoryRpgState()
- RPC get_my_story_rpg_state 호출
- 반환 타입 정의
- 실패해도 앱 전체를 깨지 않게 fallback (routes [], activeRoute null)

2. chooseStoryRoute(routeCode)
- RPC choose_story_route 호출
- 성공 후 story-rpg query invalidate

3. changeStoryRoute(routeCode)
- RPC change_story_route 호출

4. syncStoryChapterProgress(routeCode)
- RPC sync_story_chapter_progress 호출
- 실패해도 UI가 깨지지 않게 처리

5. claimStoryChapterReward(chapterId)
- RPC claim_story_chapter_reward 호출
- 성공 후 invalidate:
  - ["story-rpg"]
  - ["boxing-engagement"]
  - ["wallet"]

구현할 hooks:

1. useStoryRpgState()
- 로그인 유저 있을 때만 호출
- queryKey: ["story-rpg", user?.id, "state"]
- staleTime 30초
- fallback: routes [], activeRoute null, progress null

2. useChooseStoryRoute()
- mutation, 성공 시 story-rpg invalidate

3. useChangeStoryRoute()
- mutation

4. useSyncStoryProgress()
- mutation 또는 query side effect, UI 진입 시 수동 호출 가능

5. useClaimStoryReward()
- mutation, 성공 시 story-rpg, boxing-engagement, wallet invalidate

정적 data:

storyRpgCopy.ts:
- 메뉴명: 153 스토리 RPG
- 화면 제목: 복서의 길
- route 설명
- 오삼이 fallback 대사
- 장애물 이름/설명
- 월드맵 node 설명
- 공식 시스템 보호 안내 문구

storyRpgVisuals.ts:
- route별 색상 토큰
- node별 icon 이름
- obstacle별 emoji
- 단, 기존 UI 스타일을 크게 바꾸지 말고 data 수준으로만 둔다.

타입 (src/types/storyRpg.ts):
StoryRoute, StoryChapter, StoryNode, StoryDialogue, StoryProgress, StoryRpgState, StoryRewardResult

금지:
- member_progress update 금지
- wallet 직접 update 금지
- 공식 missions 수정 금지
- ChatAssistant 수정 금지
- 새 AI 챗봇 생성 금지
- 기존 /challenges 관련 service 수정 금지

검증:
1. 새 service/hook/data/type 파일이 생성된다.
2. 공식 보호 파일이 수정되지 않는다.
3. member_progress update 코드가 없다.
4. wallet 직접 update 코드가 없다.
5. story-rpg query key가 기존 challenges/wallet/diet와 충돌하지 않는다.
6. bun run build 통과.

작업 완료 후 출력:
1. 생성/수정한 파일 목록
2. service 함수 목록
3. hook 목록
4. 타입 목록
5. query key 목록
6. 공식 시스템 보호 방식
7. bun run build 결과
8. git diff --stat 결과
```

### 35단계 후 검증

```powershell
bun run build
```

```powershell
git status -sb
git diff --name-only | Select-String "MissionsPage|RankUpPage|ChatAssistant|challengeService|useWallet|allLevelsData|whiteLevel1Data|sharedConstants|member_progress"
```

위 명령에 결과 없어야 정상 (보호 영역 미수정 검증).

```powershell
git add src
git commit -m "feat(story-rpg): service/hook/types 데이터 레이어 (35단계)"
git push origin main
```

---

## 단계 36 — 메뉴/라우트/기본 페이지 추가

> `/story-rpg` 라우트 + HomePage 진입 카드. 페이지 뼈대만.

```
너는 지금부터 마이복서153 앱에 "153 스토리 RPG" 메뉴와 기본 페이지를 추가하는 시니어 프론트엔드 개발자다.

이번 작업은 36단계다.
목표는 앱 안에 "153 스토리 RPG" 메뉴 또는 접근 카드와 /story-rpg 라우트를 추가하고, 기본 StoryRpgPage를 표시하는 것이다.

이번 단계는 페이지 뼈대와 안전한 진입점만 만든다.
3가지 서사 선택, 월드맵, 대화창 상세 구현은 다음 단계에서 진행한다.
공식 1~40레벨 시스템은 변경하지 않는다.

절대 수정 금지:
- levels
- missions
- mission_videos
- mission_submissions
- member_progress
- MissionsPage
- RankUpPage
- ChatAssistant
- 기존 /challenges 21일 챌린지
- challengeService
- useWallet
- allLevelsData
- whiteLevel1Data
- sharedConstants의 공식 훈련 데이터

수정 가능한 파일:
- src/App.tsx
- src/pages/StoryRpgPage.tsx
- src/components/story-rpg/StoryRpgEntryCard.tsx
- src/components/story-rpg/StoryRpgPageHeader.tsx
- src/components/story-rpg/StoryRpgProtectionNotice.tsx
- src/pages/HomePage.tsx 최소 수정 가능
- src/pages/MyPage.tsx 최소 수정 가능
- BottomNav 또는 메뉴 컴포넌트는 안전성 검토 후 최소 수정

메뉴 정책:
1. route는 /story-rpg 로 추가한다.
2. 메뉴명은 "153 스토리 RPG"로 쓴다.
3. 화면 제목은 "복서의 길"로 쓴다.
4. 하단 메뉴가 너무 복잡하면 BottomNav에는 바로 추가하지 말고 HomePage와 MyPage에 진입 카드만 추가한다.
5. 하단 메뉴에 추가해도 기존 메뉴가 깨지지 않는다면 추가하되, 기존 /missions, /rank-up, /challenges, /mypage 접근성을 해치지 마라.

UI 구성:

StoryRpgPage:
- 제목: 복서의 길
- 부제: 회원에서 지도자, 프로복서, 챔피언까지 이어지는 나만의 복싱 RPG
- 내 캐릭터 요약 카드
- 현재 공식 리그/레벨 읽기 전용 표시
- 현재 선택한 스토리 루트 표시, 없으면 "아직 선택하지 않음"
- "공식 훈련은 마스터로드에서 그대로 진행됩니다" 안내
- "스토리 RPG는 QUEST 보조 게임 모드입니다" 안내
- 임시 섹션:
  - 3가지 루트 준비 영역
  - 월드맵 준비 영역
  - 오삼이 대화창 준비 영역

HomePage 카드 (StoryRpgEntryCard):
- 제목: 153 스토리 RPG
- 설명: 내 캐릭터로 복서의 길을 시작하세요.
- 버튼: 스토리 시작
- 클릭 시 /story-rpg 이동
- 위치: HomeMoreSection (펼침 영역) 안에 배치 — 첫 화면 피로감 회피

MyPage 카드 optional:
- 나의 스토리 진행도
- 현재 루트
- 현재 챕터

금지:
- 공식 XP 지급 금지
- member_progress update 금지
- 공식 missions 수정 금지
- ChatAssistant 수정 금지
- 기존 21일 챌린지 수정 금지

검증:
1. /story-rpg 라우트로 진입 가능하다.
2. HomePage 의 "더 보기" 안에서 153 스토리 RPG 카드가 보인다.
3. 기존 /home, /missions, /rank-up, /challenges, /mypage 라우트가 정상이다.
4. 공식 member_progress는 수정되지 않는다.
5. bun run build 통과.

작업 완료 후 출력:
1. 생성/수정한 파일 목록
2. 라우트 추가 위치
3. 메뉴/카드 삽입 위치
4. 공식 시스템 보호 방식
5. bun run build 결과
6. git diff --stat 결과
```

### 36단계 후 검증

```powershell
bun run build
git status -sb
git add src
git commit -m "feat(story-rpg): 메뉴/라우트/기본 페이지 (36단계) — /story-rpg + 진입 카드"
git push origin main
```

---

## 단계 37 — 3가지 서사 선택 + 챕터 진행도

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG"에 3가지 서사 선택과 챕터 진행도 UI를 구현하는 시니어 프론트엔드 개발자다.

이번 작업은 37단계다.
목표는 회원이 3가지 서사 루트 중 하나를 선택하고, 각 루트의 6개 챕터 진행도를 볼 수 있게 하는 것이다.

기존 공식 시스템은 변경하지 않는다.
스토리 루트 선택은 공식 레벨, 공식 XP, 승급에 영향을 주지 않는다.

절대 수정 금지:
- levels
- missions
- mission_videos
- mission_submissions
- member_progress
- MissionsPage
- RankUpPage
- ChatAssistant
- challengeService
- useWallet
- allLevelsData
- whiteLevel1Data
- sharedConstants의 공식 훈련 데이터

수정 가능한 파일:
- src/pages/StoryRpgPage.tsx
- src/components/story-rpg/StoryRouteSelect.tsx
- src/components/story-rpg/StoryRouteCard.tsx
- src/components/story-rpg/StoryChapterProgress.tsx
- src/components/story-rpg/StoryChapterCard.tsx
- src/components/story-rpg/StoryRouteChangeDialog.tsx
- src/hooks/useStoryRpg.ts
- src/services/storyRpgService.ts (필요한 경우 최소 수정)

구현할 UI:

1. StoryRouteSelect — 3가지 카드:

A. 마스터의 길
- 회원에서 복싱 지도자 후보로 성장
- 키워드: 기본기, 책임감, 후배, 지도자의 눈

B. 프로의 길
- 회원에서 프로복서 루틴 후보로 성장
- 키워드: 루틴, 체력, 실전 감각, 자기관리

C. 챔피언 로드
- 회원에서 챔피언의 정신으로 성장
- 키워드: 도전, 그림자 복서, 라이벌, 시즌 완주

2. 선택 동작:
- 아직 active route가 없으면 "이 길 선택하기"
- 이미 선택한 route가 있으면 "현재 선택됨"
- 다른 route는 "이 길로 변경"
- 변경 시 기존 진행도 삭제하지 않음
- change_story_route RPC 사용

3. StoryChapterProgress — 현재 active route의 6개 챕터 표시.
각 챕터 상태: locked / available / in_progress / completed / reward_claimed

4. 챕터 카드 표시:
- 챕터 번호
- 제목
- 설명
- 월드맵 노드
- 장애물/보스 이름
- 완료 조건 요약
- 보상 요약
- 버튼:
  - 진행 조건 보기
  - 보상 받기 (조건 충족 시)
  - 연결 퀘스트로 이동

5. 공식 보호 안내 (화면 하단):
"153 스토리 RPG는 공식 레벨업이 아닌 보조 게임 모드입니다. 공식 레벨업은 마스터로드의 훈련 미션과 코치 승인 기준으로 진행됩니다."

보상:
- claimStoryChapterReward hook 사용
- 성공 시 보상 표시
- 공식 XP 지급 없음
- wallet 직접 update 없음

금지:
- member_progress update 금지
- official XP 지급 금지
- 공식 미션 자동 완료 금지
- ChatAssistant 수정 금지

검증:
1. 3가지 루트가 표시된다.
2. 루트를 선택할 수 있다.
3. 선택한 루트가 유지된다.
4. 루트 변경 시 기존 진행도가 삭제되지 않는다.
5. 6개 챕터가 표시된다.
6. 챕터 상태가 표시된다.
7. 공식 XP/member_progress는 수정되지 않는다.
8. bun run build 통과.

작업 완료 후 출력:
1. 생성/수정한 파일 목록
2. 루트 선택 흐름
3. 챕터 상태 계산 방식
4. 보상 연결 방식
5. 공식 시스템 보호 방식
6. bun run build 결과
7. git diff --stat 결과
```

### 37단계 후 검증

```powershell
bun run build
git status -sb
git add src
git commit -m "feat(story-rpg): 3가지 서사 선택 + 챕터 진행도 UI (37단계)"
git push origin main
```

---

## 단계 38 — RPG 월드맵 + 오삼이 대화창

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG"에 레트로 RPG 감성의 월드맵과 오삼이 대화창을 구현하는 시니어 프론트엔드 개발자다.

이번 작업은 38단계다.
목표는 153 스토리 RPG 화면에 월드맵 노드, 내 캐릭터, 오삼이 대화창, 선택지 버튼을 구현하는 것이다.

벤치마크 감성:
레트로 RPG의 대화창, 월드맵, 챕터 노드, NPC 안내.
단, 환세취호전의 캐릭터, 이미지, 명칭, 스토리, 대사, 설정은 절대 사용하지 않는다.
마이복서153 자체 세계관만 사용한다.

절대 수정 금지:
- levels
- missions
- mission_videos
- mission_submissions
- member_progress
- MissionsPage
- RankUpPage
- ChatAssistant
- supabase/functions/chat-assistant
- challengeService
- useWallet
- allLevelsData
- whiteLevel1Data
- sharedConstants의 공식 훈련 데이터

수정 가능한 파일:
- src/pages/StoryRpgPage.tsx
- src/components/story-rpg/StoryWorldMap.tsx
- src/components/story-rpg/StoryWorldNode.tsx
- src/components/story-rpg/StoryDialogBox.tsx
- src/components/story-rpg/StoryCharacterPanel.tsx
- src/components/story-rpg/StoryObstacleBadge.tsx
- src/components/story-rpg/StoryQuestActions.tsx
- src/data/storyRpgVisuals.ts
- src/data/storyRpgCopy.ts

구현할 UI:

1. StoryCharacterPanel
- 기존 캐릭터 데이터가 있으면 표시
- 닉네임
- 공식 리그/레벨 read-only
- 선택한 스토리 루트
- 현재 챕터
- 대표 칭호
- 스토리 진행률

2. StoryWorldMap — 노드:
- 체육관 입구
- 거울 앞
- 줄넘기 존
- 샌드백 존
- 링
- 코너
- 복싱 전당
- 마스터룸
- 파이트 캠프
- 라이벌 아레나

각 노드 상태: locked / current / cleared / optional

3. StoryWorldNode
- node icon
- node title
- node description
- 현재 챕터와 연결된 노드 강조
- 모바일에서 카드형으로 표시
- desktop이면 grid 형태

4. StoryDialogBox
- speaker: 오삼이
- 대사 body
- typewriter 효과는 선택 사항. 너무 무거우면 생략.
- 선택지 버튼:
  - 오늘의 퀘스트 보기
  - 복싱 IQ 풀기
  - 챌린지 아레나
  - 챔피언 일기
  - 보상 확인
- 선택지는 실제 route 이동 또는 callback만 제공

5. StoryObstacleBadge — 사람이 아니라 습관/장애물:
- 게으름 슬라임
- 가드 브레이커
- 숨참기 유령
- 손목꺾임 괴물
- 포기 악마
- 핑계 도깨비
- 긴장 늑대
- 비교 괴물
- 과훈련 골렘

6. StoryQuestActions — 챕터 관련 기존 기능 링크:
- 복싱 IQ: quiz modal 또는 /home anchor
- 챌린지 아레나
- 챔피언 일기
- 세컨드 응원
- 시즌 파이트 캠프
- 라이벌 시즌 (있으면)
- 그림자 복서 (있으면)

주의:
기존 기능을 직접 수정하지 말고, 링크/버튼으로 연결만 한다.

디자인 톤:
- 기존 마이복서153 UI와 통일
- 레트로 RPG 감성은 대화창, 노드, 아이콘, 카피에서만 표현
- 너무 유치하지 않게
- 모바일 우선
- 모달/시트가 있다면 z-[70] 이상

문구 (자체 카피):
- "오늘도 링이 열렸습니다."
- "처음부터 강한 복서는 없습니다. 하지만 오늘의 라운드를 피하지 않는 사람은 이미 복서의 길 위에 있습니다."
- "이번 상대는 사람이 아닙니다. 나를 멈추게 하는 습관입니다."
- "공식 훈련은 마스터로드에서 그대로 진행됩니다."

금지:
- official XP 지급 금지
- member_progress update 금지
- ChatAssistant 수정 금지
- 기존 공식 미션 자동 완료 금지
- 환세취호전 관련 이름/이미지/대사 사용 금지
- 실존 복서/영화/만화/실제 명언 사용 금지

검증:
1. StoryWorldMap이 표시된다.
2. 현재 챕터 노드가 강조된다.
3. 오삼이 대화창이 표시된다.
4. 내 캐릭터 패널이 표시된다.
5. 장애물이 습관/상태로 표현된다.
6. 기존 기능으로 연결 버튼이 동작한다.
7. 공식 시스템은 수정되지 않는다.
8. bun run build 통과.

작업 완료 후 출력:
1. 생성/수정한 파일 목록
2. 월드맵 구조
3. 대화창 구조
4. 기존 기능 연결 방식
5. 저작권 회피 방식
6. 공식 시스템 보호 방식
7. bun run build 결과
8. git diff --stat 결과
```

### 38단계 후 검증

```powershell
bun run build
git status -sb
git add src
git commit -m "feat(story-rpg): 월드맵 + 오삼이 대화창 + 캐릭터 패널 (38단계)"
git push origin main
```

---

## 단계 39 — QUEST 활동과 진행도 연결 + 보상

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG"를 기존 QUEST 활동과 연결하고, 챕터 진행/보상 시스템을 완성하는 시니어 풀스택 개발자다.

이번 작업은 39단계다.
목표는 퀴즈, 챌린지, 일기, 응원, 시즌, 카드, 라이벌 등 기존 QUEST 활동을 스토리 챕터 진행 조건으로 연결하고, 조건 충족 시 보상을 claim할 수 있게 하는 것이다.

가장 중요한 원칙:
스토리 진행은 공식 1~40레벨 훈련과 분리된다.
스토리 보상은 공식 XP가 아니다.
member_progress.total_xp를 절대 수정하지 마라.
공식 미션을 자동 완료하지 마라.
공식 보스전을 자동 통과시키지 마라.

절대 수정 금지:
- levels
- missions
- mission_videos
- mission_submissions
- member_progress
- MissionsPage
- RankUpPage
- ChatAssistant
- challengeService
- useWallet
- allLevelsData
- whiteLevel1Data
- sharedConstants의 공식 훈련 데이터

수정 가능한 파일:
- src/pages/StoryRpgPage.tsx
- src/components/story-rpg/StoryChapterProgress.tsx
- src/components/story-rpg/StoryRewardPanel.tsx
- src/components/story-rpg/StoryQuestActions.tsx
- src/hooks/useStoryRpg.ts
- src/services/storyRpgService.ts
- 필요한 경우 신규 migration으로 completion 조건 보정

진행 조건 설계:

마스터의 길:
1. 첫 글러브: active route 선택 + 챔피언 일기 1개 또는 퀴즈 1개
2. 기본기의 벽: 복싱 IQ 정답 3개 + 재미 챌린지 1회
3. 반복의 방: 챌린지 3회 + 챔피언 일기 2개
4. 후배의 등장: 세컨드 응원 3회 + RP 일정 이상
5. 지도자의 눈: 복싱 IQ 정답 10개 + 챔피언 일기 5개 + 응원 5회
6. 마스터 테스트: 숨겨진 미션 1개 이상 + 카드 수집 3장 (있으면) 또는 QUEST XP 일정

프로의 길:
1. 취미반의 시작: 챌린지 1회
2. 루틴의 탄생: 챌린지 3회 + 컨디션 기록 3회 (있으면)
3. 첫 스파링의 긴장: 매너/안전 퀴즈 3개 + 챔피언 일기 2개
4. 체력의 벽: 샌드백/줄넘기/스쿼트/푸시업 계열 챌린지 3회
5. 나의 스타일: 복서 스타일 진단 데이터 + 챌린지 5회 + 퀴즈 정답 10개
6. 프로 루틴 테스트: 최근 7일 QUEST 활동 3일 이상 + 챌린지 8회 + 일기 4개

챔피언 로드:
1. 도전자의 문: 챌린지 1회 + 복싱 IQ 1문제
2. 그림자 복서: 그림자 복서 snapshot/claim (있으면) / fallback QUEST XP 일정
3. 라이벌 매칭: 라이벌 시즌 opt-in (있으면) / fallback 세컨드 응원 5회
4. 파이트 캠프: 시즌 파이트 캠프 참여 (있으면) / fallback 챌린지 5회
5. 마지막 라운드: 챔피언 일기 7개 + 숨겨진 미션 2개 이상 (있으면)
6. 챔피언 나이트: 시즌 완주 또는 카드 6장 이상 (있으면) / fallback QUEST XP 일정

중요:
존재하지 않는 테이블/기능은 참조하지 말고 fallback 조건을 사용하라.
RPC에서 실제 schema 존재 여부를 확인하고 안전하게 작성하라.

UI:
1. 챕터 카드에 현재 조건 달성률 표시
   예: 복싱 IQ 3/10 / 챌린지 2/5 / 일기 1/4
2. 조건 충족 시: "챕터 클리어" + "보상 받기" 버튼 활성화
3. 보상 claim 후: "보상 수령 완료" + QUEST XP / 파이트 머니 / 칭호 / 카드 표시
4. 보상 결과 모달/토스트:
   - "챕터 클리어!"
   - "내 복서의 이야기가 다음 장으로 넘어갑니다."
5. 스토리 sync 버튼: "진행도 새로고침" → sync_story_chapter_progress 호출

보상 지급:
- claim_story_chapter_reward RPC 반환값 기준
- wallet 직접 update 금지
- 공식 XP 지급 금지

연동:
기존 퀴즈/챌린지/일기/응원 성공 후 story sync를 자동 호출할 수 있다.
단, 실패해도 원래 기능 성공을 막지 않는다.
자동 sync가 부담되면 StoryRpgPage 진입 시 sync만 우선 구현한다.

금지:
- member_progress update 금지
- official XP 지급 금지
- 공식 mission 자동 완료 금지
- wallet 직접 update 금지
- ChatAssistant 수정 금지

검증:
1. StoryRpgPage 진입 시 progress sync 가능하다.
2. 챕터별 조건 달성률이 표시된다.
3. 조건 충족 시 보상 버튼이 활성화된다.
4. 보상 claim 가능하다.
5. 중복 보상이 막힌다.
6. 공식 member_progress는 수정되지 않는다.
7. wallet 직접 update가 없다.
8. bun run build 통과.

작업 완료 후 출력:
1. 생성/수정한 파일 목록
2. 각 루트별 챕터 조건 요약
3. progress sync 방식
4. reward claim 방식
5. fallback 조건 처리 방식
6. 공식 시스템 보호 방식
7. bun run build 결과
8. git diff --stat 결과
```

### 39단계 후 검증

```powershell
bun run build
```

금지 패턴 grep:

```powershell
git diff --name-only HEAD~1 | Select-String "MissionsPage|RankUpPage|ChatAssistant|challengeService|useWallet|allLevelsData|whiteLevel1Data|sharedConstants"
```

```powershell
Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern 'from\("member_progress"\)\.update|from\("user_wallets"\)\.update|from\("wallets"\)\.update' -SimpleMatch:$false
```

위 grep 모두 결과 없어야 정상.

```powershell
git add src supabase
git commit -m "feat(story-rpg): QUEST 활동 연결 + 보상 claim (39단계)"
git push origin main
```

---

## 단계 40 — QA / 빌드 / 배포 검증

```
너는 지금부터 마이복서153 앱의 "153 스토리 RPG" 전체 QA와 회귀 테스트를 수행하는 시니어 QA 엔지니어이자 코드 리뷰어다.

이번 작업은 40단계다.
목표는 33~39단계에서 추가된 153 스토리 RPG가 기존 공식 1~40레벨 시스템과 충돌하지 않는지 검증하고, QA 리포트를 작성하는 것이다.

이번 단계에서는 새 기능을 만들지 마라.
큰 리팩터링을 하지 마라.
공식 1~40레벨 훈련 리스트를 수정하지 마라.
치명적인 빌드 오류나 타입 오류가 있으면 새로 추가된 story-rpg 파일 중심으로만 최소 수정하라.
보호 영역 수정이 필요해 보이면 직접 수정하지 말고 보고하라.

생성할 문서: docs/153-story-rpg-qa-regression-report.md

절대 수정 금지:
- levels
- missions
- mission_videos
- mission_submissions
- member_progress
- approve_mission_submission
- record_attendance
- useManualLevelUp
- usePassBossBattle
- MissionsPage
- RankUpPage
- ChatAssistant
- supabase/functions/chat-assistant
- 기존 /challenges 21일 챌린지
- challengeService
- useWallet
- allLevelsData
- whiteLevel1Data
- sharedConstants의 공식 훈련 데이터
- src/integrations/supabase/types.ts 직접 수동 수정

먼저 확인:
1. git status -sb
2. git diff --stat
3. git diff --name-only
4. 새 migration 파일명이 단조 증가하는지 확인
5. 보호 파일이 변경되었는지 확인
6. member_progress update 코드가 새로 생겼는지 grep
7. wallet 직접 update 코드가 새로 생겼는지 grep
8. ChatAssistant 또는 chat-assistant Edge Function이 수정되었는지 확인
9. 기존 /challenges 관련 파일이 수정되었는지 확인
10. BottomNav 변경이 있다면 기존 메뉴 접근성이 깨지지 않았는지 확인
11. 새 모달 z-index가 z-[70] 이상인지 확인
12. query key prefix가 기존 diet/challenges/wallet과 충돌하지 않는지 확인
13. seed 데이터에 환세취호전 또는 실존 선수/영화/만화/실제 명언이 들어갔는지 확인

금지 패턴 grep:
- from("member_progress").update
- from('member_progress').update
- from("user_wallets").update
- from('user_wallets').update
- from("wallets").update
- from('wallets').update
- rpc("approve_mission_submission"
- rpc('approve_mission_submission'
- rpc("record_attendance"
- rpc('record_attendance'
- submitChallengeCheckin
- syncQuestCheckin
- ChatAssistant
- chat-assistant
- 환세취호전
- 아타호
- 린샹
- 호랑이 권법
- Rocky / 록키
- Tyson / 타이슨
- Ali / 알리
- Mayweather / 메이웨더
- Pacquiao / 파퀴아오
- Ippo / 잇포
- Inoue / 이노우에

기존 문서 백로그에 있는 명칭은 괜찮을 수 있으나, 앱 seed/사용자 노출 콘텐츠에는 금지한다.

검증할 기존 기능:

A. 공식 1~40 훈련 시스템
- /missions 진입 가능
- 공식 미션 row 정상
- 영상 모달 정상
- 미션 제출 흐름 정상
- 코치 승인 흐름 변경 없음
- 관리자 즉시 클리어 흐름 변경 없음
- 공식 훈련 리스트 데이터 변경 없음

B. 공식 랭크업 / 레벨맵
- /rank-up 진입 가능
- 로드맵 정상
- 가치맵 정상
- 보스전/타이틀매치 흐름 변경 없음
- 관리자 레벨 수정 흐름 변경 없음
- 1~40 공식 구조 변경 없음

C. 기존 QUEST 기능
- 오삼이 브리핑 정상
- 복싱 IQ 정상
- 재미 챌린지 정상
- 통증 체크 정상
- 챔피언 일기 정상
- 세컨드 응원 정상
- 복싱 전당 정상
- 컨디션 게이지 정상
- 리턴 라운드 정상
- 숨겨진 미션 정상
- 스타일 진단 정상
- 성장 리포트 정상
- 코너맨/그림자 복서/짐 레이드/시즌/카드/라디오 기능이 있으면 정상

D. 153 스토리 RPG 신규 기능
- /story-rpg 진입 가능
- HomePage 또는 메뉴 카드에서 진입 가능
- 내 캐릭터 패널 표시
- 공식 리그/레벨은 read-only 표시
- 마스터의 길 / 프로의 길 / 챔피언 로드 모두 선택 가능
- 루트 변경 가능
- 기존 진행도 삭제되지 않음
- 각 루트 6챕터 표시
- 월드맵 노드 표시
- 오삼이 대화창 표시
- 장애물이 습관/상태로 표현됨
- 기존 QUEST 활동과 챕터 진행도 연결
- 조건 충족 시 보상 claim 가능
- 중복 보상 방지
- 공식 XP 지급 없음
- 공식 미션 자동 완료 없음
- 공식 보스전 자동 통과 없음

E. 권리/안전
- 환세취호전 캐릭터/스토리/명칭/대사/이미지 없음
- 실존 선수/영화/만화/실제 명언 seed 없음
- 폭력적 사람 공격 구조 없음
- 적은 나쁜 습관/상태로 표현
- 과훈련/통증 관련 안전 문구 유지

빌드/검사:
1. bun run build 실행
2. lint는 기존 lint 오류가 많으면 참고용으로만 기록
3. git status -sb 확인
4. git diff --stat 확인
5. 새 migration이 있다면 Supabase SQL Editor 실행 순서 문서화
6. 새 migration 실제 DB 반영 여부 확인 쿼리 작성

QA 리포트 구조:

# 153 스토리 RPG QA / 회귀 테스트 리포트

1. 테스트 일시
2. 확인한 브랜치/커밋
3. 스토리 RPG 추가 기능 요약
4. 보호 영역 변경 여부
5. 공식 1~40레벨 시스템 점검 결과
6. 공식 XP / QUEST XP 분리 점검 결과
7. 파이트 머니 지급 경로 점검 결과
8. 기존 21일 챌린지 점검 결과
9. ChatAssistant 단일 경로 점검 결과
10. 기존 QUEST 기능 회귀 테스트 결과
11. 153 스토리 RPG 신규 기능 테스트 결과
12. 3가지 서사 테스트 결과
13. 월드맵/대화창 테스트 결과
14. 보상/중복 방지 테스트 결과
15. 권리/저작권 회피 점검 결과
16. 안전/아동청소년 적합성 점검 결과
17. DB/RPC/migration 점검 결과
18. 빌드 결과
19. 발견한 문제
20. 수정한 문제 (있다면)
21. 남은 TODO
22. 후속 확장 아이디어
23. 최종 판정 (PASS / PASS_WITH_NOTES / BLOCKED)

최종 판정 기준:

PASS:
- bun run build 통과
- 보호 영역 변경 없음
- 공식 XP 오염 없음
- member_progress update 없음
- wallet 직접 update 없음
- 기존 /missions, /rank-up, /challenges 정상
- ChatAssistant 단일 경로 유지
- 153 스토리 RPG 정상
- 저작권/권리 문제 seed 없음

PASS_WITH_NOTES:
- 핵심 기능은 정상이나 minor UI/TODO 있음
- 보호 영역 영향 없음
- 배포 가능하나 후속 개선 사항 있음

BLOCKED:
- 공식 레벨 시스템 변경 발견
- member_progress 오염 가능성 발견
- wallet 직접 update 발견
- 기존 /challenges 깨짐
- ChatAssistant 중복/변경 발견
- 환세취호전/실존 콘텐츠 seed 삽입 발견
- 빌드 실패
- migration 적용 불가

작업 완료 후 출력:
1. QA 리포트 파일 경로
2. 최종 판정
3. 보호 영역 변경 여부
4. 공식 XP 오염 여부
5. member_progress update 여부
6. wallet 직접 update 여부
7. 기존 /missions, /rank-up, /challenges 영향 여부
8. ChatAssistant 영향 여부
9. 153 스토리 RPG 기능별 결과
10. 권리/안전 검토 결과
11. bun run build 결과
12. 배포 전 필요한 migration 실행 목록
13. 남은 TODO
14. git diff --stat 결과
```

### 40단계 후 — 최종 푸시

```powershell
bun run build
git status -sb
git add docs
git commit -m "docs(story-rpg): QA 회귀 리포트 (40단계)"
git push origin main
```

```powershell
git status -sb
```

→ `## main...origin/main` 떠야 정상.

---

## 단계 후 공통 검증 (모든 단계 공통)

```powershell
bun run build
```

```powershell
git status -sb
```

```powershell
git diff --name-only | Select-String "MissionsPage|RankUpPage|ChatAssistant|challengeService|useWallet|allLevelsData|whiteLevel1Data|sharedConstants|member_progress"
```

위 grep 결과가 비어있어야 정상 (보호 영역 미수정 검증).

```powershell
Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern '환세취호전|아타호|린샹'
```

```powershell
Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern 'Rocky|Tyson|Ali|Mayweather|Pacquiao|Ippo|Inoue|록키|타이슨|알리|메이웨더|파퀴아오|잇포|이노우에'
```

위 두 grep 도 결과 없어야 정상 (저작권 회피 검증).

---

## 최종 앱 구조

```
마이복서153
├─ 마스터로드
│  └─ 공식 1~40레벨 성장 과정
│
├─ 153 QUEST
│  └─ 퀴즈, 챌린지, 일기, 응원, 시즌, 카드
│
└─ 153 스토리 RPG
   └─ 복서의 길
      ├─ 마스터의 길
      ├─ 프로의 길
      └─ 챔피언 로드
```

**한 줄 정리:**
153 스토리 RPG 는 기존 시스템을 바꾸는 기능이 아니라, 기존 캐릭터와 QUEST 활동을 읽어서 회원의 복서 인생을 RPG 처럼 보여주는 별도 게임 모드입니다.
