# 153 QUEST 몰입 레이어 전체 백로그 / 로드맵

> 본 문서는 153 랭킹업 시스템 위에 얹는 **몰입·재미·스토리·커뮤니티 보조 레이어**의 전체 아이디어 백로그다.
> 공식 1~40레벨 훈련 시스템은 별도 프로젝트로 추후 디테일 업그레이드되며, 이번 몰입 업데이트에서는 **건드리지 않는다**.
> 작성: 2단계 (문서 단계). 코드 / 마이그레이션 / RPC / 컴포넌트 변경 없음.

---

## 1. 전체 방향

- **153 랭킹업 시스템**은 공식 1~40레벨 복싱 성장 과정(코치 승인·미션 제출·보스전·승급)을 그대로 유지한다.
- **153 QUEST**는 그 위에 붙는 **재미 / 몰입 / 스토리 / 커뮤니티 보조 레이어**다. 공식 레벨업의 조건이 아니다.
- 회원은 더 이상 "운동 기록자"가 아니라, **자기 자신을 주인공으로 플레이하는 복싱 성장 RPG의 주인공**이 된다.
- **오삼이**는 AI NPC이자 디지털 세컨드 — 회원의 옆에서 4단계 페르소나(자상한 관장님 → 엄한 트레이너 → 코너맨 → 동료 챔피언)로 동행한다.
- 기본 철학: **"공식 = 진지한 성장, QUEST = 즐거운 성장"** 이 두 트랙을 분리해 회원의 몰입을 깊게 가져간다.

---

## 2. 공식 시스템 보호 원칙

| # | 원칙 |
|---|---|
| 1 | 1~40레벨 공식 훈련 리스트는 **별도 프로젝트로 나중에 하나씩 디테일 업그레이드**한다. |
| 2 | 이번 몰입 업데이트(QUEST v1)에서는 **공식 훈련 리스트를 수정하지 않는다**. |
| 3 | 공식 레벨업은 기존 **코치 승인 + 미션 제출 + 보스전 + 승급** 구조로만 진행된다. |
| 4 | **QUEST XP는 공식 XP와 완전 분리**된다. QUEST XP는 공식 레벨/리그를 결정하지 않는다. |
| 5 | 파이트 머니는 **기존 RPC(`grant_gems`) 또는 신규 SECURITY DEFINER 서버 RPC**를 통해서만 지급한다. 클라이언트 직접 update 금지. |
| 6 | **ChatAssistant**는 기존 단일 경로(`src/components/ChatAssistant.tsx` + `supabase/functions/chat-assistant`)를 유지한다. 새 AI 챗박스 추가 금지. |
| 7 | 보호 대상 테이블: `levels`, `missions`, `mission_videos`, `mission_submissions`, `member_progress`, `quests`, `quest_submissions`, `xp_logs`. |
| 8 | 보호 대상 RPC: `approve_mission_submission`, `approve_quest_submission`, `pass_boss_battle`, `grant_manual_xp`, `record_attendance`, `set_member_level`, `manual_level_up/down`. |
| 9 | 보호 대상 훅: `useLevels`, `useQuests`, `useMissions`, `useApproveSubmission`, `usePassBossBattle`, `useGrantManualXp`, `useRecordAttendance`, `useManualLevelUp/Down`. |

---

## 3. 아이디어 상태 태그 정의

| 태그 | 의미 |
|---|---|
| `implement_now` | 이번 v1에서 실제 구현 |
| `design_only` | 설계만 하고 구현 보류 (스펙·UX 정리만) |
| `backlog_v1_5` | v1.5에서 구현 |
| `backlog_v2` | v2에서 구현 |
| `backlog_v2_5` | v2.5에서 구현 |
| `backlog_v3` | v3에서 구현 |
| `rights_review_required` | 저작권/초상권/상표권 검토 필요. 클리어 전엔 seed 데이터에 넣지 않음 |
| `safety_review_required` | 부상 위험 또는 안전 검토 필요. 코치 감독 또는 대체 미션 전환 필요 |
| `official_level_future_work` | 1~40레벨 공식 훈련 리스트 개편 시 별도 검토 — 이번 작업 범위 밖 |

---

## 4. 우리가 처음부터 만든 아이디어 전체 목록

| 아이디어 | 설명 | 상태 | 구현 단계 | 공식 1~40레벨 영향 | 주의사항 |
|---|---|---|---|---|---|
| 회원 자신이 주인공인 복싱 성장 RPG | 회원 = 메인 캐릭터, 모든 콘텐츠가 1인칭 서사 | implement_now | v1 | 없음 | 공식 레벨/XP는 그대로, 별도 QUEST XP 사용 |
| 마스터 로드 세계관 | White → Blue → Red → Black 4막 일대기 | design_only | v1.2~v2 | 없음 | 표현·연출만 강화, 승급 조건은 공식 보스전 |
| 오삼이 NPC / 디지털 세컨드 | AI 챗봇 + 정적 카드 페르소나 통합 | implement_now | v1 | 없음 | ChatAssistant 단일 경로 유지, 신규 챗박스 X |
| 앱 실행 시 오늘의 라운드 브리핑 | 진입 즉시 노출되는 정적 카드 | implement_now | v1 | 없음 | HomePage 헤더 직후 카드 |
| 컨디션 선택 기반 미션 추천 | 좋음/보통/피로 선택 → 미션 강도 추천 | backlog_v1_5 | v1.5 | 없음 | 공식 미션 강요 안 함, 보조 추천만 |
| 오늘의 메인 미션 | 매일 1개 핵심 미션 | implement_now | v1 | 없음 | 공식 미션과 분리, QUEST 카테고리 |
| 서브 미션 | 보조 미니 미션 2~3개 | implement_now | v1 | 없음 | — |
| 지식 미션 | 복싱 IQ 퀴즈 형태 | implement_now | v1 | 없음 | 정답 시 QUEST XP + RP |
| 감정 미션 | 회고·일기·자기관찰 | implement_now | v1 | 없음 | 챔피언 일기와 연동 |
| 보너스 미션 | 주간 한정 추가 보상 | backlog_v1_5 | v1.5 | 없음 | — |
| 복싱 정보 카드 | 시대·인물·스타일 등 1장씩 수집 | design_only | v2.5 | 없음 | 실존 인물은 rights_review_required |
| 감동 스토리형 미션 | 단편 스토리 → 행동 미션 연계 | backlog_v2 | v2 | 없음 | 자체 창작 우선 |
| 오삼이 상황별 대사 | 출석/완료/복귀/승급 등 대사 풀 | implement_now | v1 | 없음 | questMessageEngine 패턴 |
| 복싱 백과 / 복싱 도감 | 용어/기술/규칙 모음 | backlog_v1_5 | v1.5 | 없음 | original_safe 콘텐츠만 |
| XP (공식) | 보호 대상 — 공식 미션 승인으로만 적립 | — | — | **유지** | 절대 미터치 |
| 파이트 머니 | 기존 user_wallets + grant_gems RPC | implement_now (보조 지급만) | v1 | 없음 | RPC 경유만, 직접 update 금지 |
| RP (리스펙트 포인트) | 신규 화폐 — 응원·퀴즈·일기로 적립 | implement_now | v1 | 없음 | 별도 wallet/rpc |
| 배지 | 공식 vs QUEST 배지 분리 | backlog_v1_5 | v1.5 | 없음 | — |
| 칭호 | QUEST 전용 칭호 (예: 퀴즈 마스터) | implement_now | v1 | 없음 | 공식 칭호와 분리 |
| 복싱 카드 | 컬렉션 시스템 (자체 제작 카드부터) | backlog_v2_5 | v2.5 | 없음 | 실존 인물은 rights_review_required |
| 랭킹 포인트 | QUEST 전용 랭킹 산정 점수 | backlog_v1_5 | v1.5 | 없음 | 공식 XP 랭킹과 분리 |
| 복싱 스타일 진단 | 입력 답변 → 스타일 결과 | backlog_v1_5 | v1.5 | 없음 | 1회성/주기적 |
| 일일 퀘스트 | 오늘 미션 5종 묶음 | implement_now | v1 | 없음 | — |
| 주간 스토리 미션 | 7일 단위 작은 서사 | backlog_v2 | v2 | 없음 | 자체 창작 |
| 시즌제 운영 | 4주/8주 단위 시즌 | backlog_v2_5 | v2.5 | 없음 | 시즌 종료 후 보상 정산 |
| 숨겨진 미션 | 조건 발동형 (예: 연속출석 7일) | backlog_v1_5 | v1.5 | 없음 | trigger 기반 |
| 성장률 랭킹 | 주간 QUEST XP 증가량 | backlog_v2 | v2 | 없음 | 공식 XP 랭킹과 분리 |
| 출석 랭킹 | 기존 streak 활용 (공식 데이터 read-only) | design_only | v1~v2 | 영향 없음 (read만) | 기존 record_attendance 흐름 유지 |
| 기술 랭킹 | 챌린지 점수 누적 랭킹 | backlog_v2 | v2 | 없음 | — |
| 매너 랭킹 | 응원·박수 누적 | backlog_v2 | v2 | 없음 | RP 기반 |
| 복귀 랭킹 | 비활동 후 복귀 회원 가산점 | backlog_v2 | v2 | 없음 | — |
| 오늘의 선택지 | 미션 2~3개 중 1개 선택 | implement_now | v1 | 없음 | — |
| 복싱 퀴즈 | OX·객관식·상황·자세 등 | implement_now | v1 | 없음 | 별도 테이블 |
| 복귀 환영 시스템 | 7일+ 비활동 후 복귀 시 환영 카드 | implement_now | v1 | 없음 | localStorage 또는 server flag |
| 친구 응원 스티커 | 회원 → 회원 1줄 응원 | implement_now | v1 | 없음 | 일일 한도 |
| 앱 메뉴 구조 | QUEST 진입점 추가 (BottomNav 또는 SubNav) | implement_now | v1 | 없음 | 기존 탭 무수정, 추가만 |
| 푸시 알림 문구 | 오삼이 톤 일관 | backlog_v1_5 | v1.5 | 없음 | 풀 형태 |
| 보스전 연출 | 공식 보스전 내용 수정 X — 시각적 연출만 별도 | official_level_future_work | (별도 프로젝트) | **유지** | 본 작업 범위 밖 |
| 부모/회원 성장 리포트 | 주간 PDF / 카카오톡 발송 | backlog_v1_5 | v1.5 | 없음 | talktalk Edge Function 활용 |
| MVP 기능 우선순위 | 본 문서 11번 섹션 참조 | implement_now | v1 | 없음 | — |

---

## 5. 퀴즈 / 챌린지 아이디어 전체 목록

| 아이디어 | 설명 | 상태 | 구현 단계 | 공식 영향 | 주의사항 |
|---|---|---|---|---|---|
| 오삼이 복싱 아카데미 | 퀴즈 + 학습 모드 통합 진입점 | implement_now | v1 | 없음 | — |
| 퀴즈 정답 시 QUEST XP + 파이트 머니 지급 | 정답 1회 = QUEST XP n + 파이트 머니 m | implement_now | v1 | 없음 | grant_gems RPC 경유 |
| 오답 후 재도전 보상 감소 | 첫 정답 100% / 재도전 50% / 3회+ 0 | implement_now | v1 | 없음 | server-side 검증 |
| 3문제 연속 정답 보너스 | 콤보 보너스 RP +5 | implement_now | v1 | 없음 | — |
| OX 퀴즈 | 가장 가벼운 포맷 | implement_now | v1 | 없음 | — |
| 객관식 퀴즈 | 4지선다 | implement_now | v1 | 없음 | — |
| 순서 맞추기 | 동작·콤비네이션 순서 | backlog_v1_5 | v1.5 | 없음 | — |
| 상황 판단 퀴즈 | 시뮬레이션형 | backlog_v1_5 | v1.5 | 없음 | — |
| 틀린 자세 찾기 | 이미지/영상 기반 | backlog_v2 | v2 | 없음 | rights_review_required (영상 라이선스) |
| 타임어택 퀴즈 | 30초 안 다수 문제 | backlog_v1_5 | v1.5 | 없음 | — |
| 연속 정답 콤보 | 콤보 시각 효과 + RP 가산 | implement_now | v1 | 없음 | — |
| 보스 퀴즈 | 리그/시즌 종료 시 종합 퀴즈 | backlog_v2 | v2 | 없음 | — |
| 복싱 IQ 리그 | 정답률·속도 기반 시즌 랭킹 | backlog_v1_5 | v1.5 | 없음 | 별도 랭킹 |
| 챌린지 아레나 | 챌린지 모음 진입점 | implement_now | v1 | 없음 | 기존 /challenges 와 별도 라우트 |
| 스쿼트 챌린지 | 셀프 카운트 입력 | implement_now | v1 | 없음 | safety_review_required (개수 제한) |
| 푸시업 챌린지 | 셀프 카운트 입력 | implement_now | v1 | 없음 | safety_review_required |
| 잽 챌린지 | 정해진 시간 안 횟수 | implement_now | v1 | 없음 | — |
| 원투 챌린지 | 콤비네이션 횟수 | backlog_v1_5 | v1.5 | 없음 | — |
| 샌드백 챌린지 | 시간/세트 입력 | backlog_v1_5 | v1.5 | 없음 | safety_review_required |
| 줄넘기 챌린지 | 시간/횟수 | implement_now | v1 | 없음 | — |
| 가드 챌린지 | 자세 유지 시간 | backlog_v1_5 | v1.5 | 없음 | — |
| 콤비네이션 챌린지 | 정해진 콤보 정확도 | backlog_v2 | v2 | 없음 | — |
| 개인 챌린지 | 본인 vs 본인 | implement_now | v1 | 없음 | — |
| 친구 챌린지 | 1:1 도전장 | backlog_v2 | v2 | 없음 | — |
| 팀 챌린지 | 지점 vs 지점 또는 팀 vs 팀 | backlog_v2_5 | v2.5 | 없음 | — |
| 지점 챌린지 | 지점 단위 | backlog_v2 | v2 | 없음 | — |
| 시즌 챌린지 | 4주 시즌 | backlog_v2_5 | v2.5 | 없음 | — |
| 복귀 챌린지 | 비활동 회원 대상 가벼운 챌린지 | backlog_v1_5 | v1.5 | 없음 | — |
| 성장률 챌린지 | 주간 향상도 비교 | backlog_v2 | v2 | 없음 | — |
| 세컨드 응원 시스템 | 회원 → 회원 응원 | implement_now | v1 | 없음 | RP 적립 |
| 박수 보내기 | 1탭 박수 | implement_now | v1 | 없음 | 일일 한도 |
| 응원 스티커 | 미리 만든 메시지 카드 | implement_now | v1 | 없음 | original_safe 풀 |
| 도전장 보내기 | 친구에게 챌린지 초대 | backlog_v2 | v2 | 없음 | — |
| 함께 클리어 보너스 | 같은 날 친구와 함께 챌린지 완료 | backlog_v2 | v2 | 없음 | — |
| 파이트 머니 사용처 | 프레임/스킨/스티커/재도전권/카드팩/굿즈 쿠폰 | implement_now | v1 | 없음 | grant_gems / spend RPC |
| 프로필 프레임 | 꾸미기 카테고리 추가 | backlog_v1_5 | v1.5 | 없음 | 기존 customizations 재사용 |
| 오삼이 스킨 | 오삼 캐릭터 외형 | backlog_v2 | v2 | 없음 | original_safe |
| 응원 스티커 구매 | 한정 스티커 팩 | backlog_v1_5 | v1.5 | 없음 | — |
| 챌린지 재도전권 | 보상 0 → 1회 더 도전 | backlog_v1_5 | v1.5 | 없음 | — |
| 카드팩 | 카드 수집과 연동 | backlog_v2_5 | v2.5 | 없음 | rights_review_required (실존) |
| 체육관 굿즈 쿠폰 가능성 | 오프라인 연계 | backlog_v3 | v3 | 없음 | 운영 검토 |
| 챌린지 안전장치 | 통증 체크 / 쿨타임 / 강도 게이트 | implement_now | v1 | 없음 | safety_review_required |
| 통증 체크 | 챌린지 시작 전 1회 yes/no | implement_now | v1 | 없음 | — |
| 고강도 챌린지 쿨타임 | 24시간 쿨타임 | implement_now | v1 | 없음 | — |
| 챌린지 점수 계산 | 본인 베스트 + 정확도 가산 | implement_now | v1 | 없음 | — |
| 퀴즈 후 챌린지 해금 | 관련 퀴즈 정답 시 챌린지 활성 | backlog_v1_5 | v1.5 | 없음 | "퀴즈 → 챌린지" 흐름 |

---

## 6. 클로드 아이디어 전체 목록

### 4막 복서 일대기

| 막 | 리그 | 페르소나 / 서사 | 상태 |
|---|---|---|---|
| White | Lv 1~10 | 신인 — 첫 발걸음, 자상한 관장님이 돕는다 | design_only |
| Blue | Lv 11~20 | 선수 — 콤비네이션·디펜스, 엄한 트레이너 등장 | design_only |
| Red | Lv 21~30 | 도전자 — 스파링·실전, 코너맨이 옆에 | design_only |
| Black | Lv 31~40 | 챔피언/마스터 — 동료 챔피언과 함께 정상에 | design_only |

> 4막 서사는 시각/카피 연출만 — 공식 승급 조건은 그대로.

### 오삼이 NPC 진화 시스템

| 진화 단계 | 등장 시점 | 역할 | 상태 |
|---|---|---|---|
| 새벽 트레이너 | White 초반 | 기본 자세·풋워크 안내 | implement_now (초기 페르소나) |
| 코너맨 | Red ~ Black | 시합 직전 코칭 | backlog_v2 |
| 선배 복서 | Blue ~ Red | 경험담·조언 | backlog_v2 |
| 그리운 동료 | Black 후반 | 마스터 단계 동행 | backlog_v3 |
| 관장님 | 전 단계 누적 | 큰 결정 시 등장 | design_only |

### 계급별 오삼이 페르소나 (대사 톤)

| 리그 | 페르소나 | 톤 | 상태 |
|---|---|---|---|
| White | 자상한 관장님 | 다정·격려 | implement_now |
| Blue | 엄한 트레이너 | 단단·구체 | backlog_v1_5 |
| Red | 코너맨 | 짧고 강하게 | backlog_v2 |
| Black | 동료 챔피언 | 존중·동등 | backlog_v2_5 |

### 일일 콘텐츠 루틴

| 시간대 | 콘텐츠 | 상태 |
|---|---|---|
| 아침 | 한마디 (정적 카드) | implement_now |
| 오전 | 오늘의 미션 브리핑 | implement_now |
| 운동 후 | 칭찬 / 회고 유도 | implement_now |
| 밤 | 챔피언 일기 | implement_now |

### 일일 미션 5종

| 종류 | 예시 | 상태 |
|---|---|---|
| 트레이닝 미션 | 줄넘기 5분 | implement_now |
| 복싱 IQ 미션 | 퀴즈 3문제 | implement_now |
| 스토리 미션 | 오삼이 한마디 읽기 | implement_now |
| 자기관찰 미션 | 컨디션 1줄 기록 | implement_now |
| 커뮤니티 미션 | 친구 응원 1회 | implement_now |

### 그 외 클로드 큰 아이디어

| 아이디어 | 설명 | 상태 |
|---|---|---|
| 그림자 복서 | AI 가상 라이벌 (회원 데이터 기반 시뮬레이션) | backlog_v3 |
| 코너맨 시스템 | 회원 간 코칭/응원 매칭 | backlog_v2 |
| 라이벌 매칭 4주 시즌 | 시즌 단위 1:1 비교 | backlog_v3 |
| 레전드 어록/스토리 컬렉션 300장 | 자체 + 실존 혼합 | backlog_v3 + rights_review_required |
| 명장면 챌린지 | 안전 변환 후 9번 섹션 표 참조 | backlog_v3 + safety_review_required |
| 나만의 복싱 전당 | 본인 컬렉션 페이지 | implement_now (요약 카드만) |
| 챔피언 일기 90일 회고 | 일기 → 90일 차 회고 모음 | implement_now (일기 자체만) |
| 시즌 스토리 패스 | 시즌 단위 패스 보상 | backlog_v2_5 |
| 블랙 한정 트레이너 시스템 | Black 진입자 전용 | backlog_v3 |
| 오삼이 라디오 | 음성/짧은 영상 콘텐츠 | backlog_v3 |

### 단계별 출시 로드맵

| Phase | 내용 | 상태 |
|---|---|---|
| Phase 1 — 스토리 골격 | 오삼이 페르소나 1단계, 오늘의 브리핑, 일일 미션 5종 | v1 implement_now |
| Phase 2 — 수집 / 소셜 | 카드 수집 v0, 응원 시스템, 복싱 백과 | v1.5 ~ v2 |
| Phase 3 — 그림자 복서 / 시즌 | 라이벌·시즌 운영 | v2.5 ~ v3 |
| Phase 4 — 글로벌 확장 | 다국어 / 글로벌 시즌 | post-v3 |

---

## 7. 우리가 추가 제안한 보완 아이디어 전체 목록

| 아이디어 | 설명 | 상태 |
|---|---|---|
| 퀴즈 → 챌린지 해금 구조 | 관련 퀴즈 정답 시 챌린지 잠금 해제 | backlog_v1_5 |
| 복싱 IQ 리그 | 정답률·속도 시즌 랭킹 | backlog_v1_5 |
| 파이트 머니 사용처 확장 | 프레임/스킨/스티커/재도전권/카드팩 | implement_now (기본 사용처 일부) |
| RP 리스펙트 포인트 | 응원·퀴즈·일기 적립 | implement_now |
| 팀 레이드 / 짐 레이드 | 지점 단위 보스전 형태 | backlog_v2_5 |
| 4주 파이트 캠프 | 시즌형 미션 모음 | backlog_v2_5 |
| 보스전 = 운동 + 퀴즈 + 회고 | 공식 보스전 내용 수정 X — 별도 "QUEST 보스" 분리 | design_only / official_level_future_work |
| 리턴 라운드 | 복귀 회원 환영 라운드 | backlog_v1_5 |
| 컨디션 게이지 | 일일 자기보고 1탭 | backlog_v1_5 |
| 부상 방지 피로도 시스템 | 고강도 챌린지 후 쿨타임 | implement_now (쿨타임 부분) |
| 코치 대시보드 | 회원 QUEST 활동 모니터링 | backlog_v2 |
| 퀴즈 포맷 10개 | 5번 섹션 참조 | implement_now (OX·객관식만 v1) |
| 회원 복서 스타일 진단 | 답변 → 스타일 라벨 | backlog_v1_5 |
| 응원 대사 자동 추천 | 상황별 응원 메시지 풀 | implement_now |
| 체육관 현장 연동 이벤트 | QR 이벤트·오프라인 미션 | backlog_v3 |
| 복싱 전당 마이페이지 확장 | 카드/배지/일기 통합 | backlog_v2_5 |

---

## 8. 권리 / 안전 처리 규칙

### 권리 처리 규칙

| 상태 | 처리 |
|---|---|
| `original_safe` | 자체 제작 문구·캐릭터·스토리. 즉시 사용 가능 |
| `public_reference_needs_review` | 역사적 사실(경기 결과·연도 등) 참고 가능. 문구는 검토 필요 |
| `licensed_required` | 실존 선수 이름·사진·영상·영화/만화 장면·명장면 클립. **권리 확인 전 seed 데이터 삽입 금지** |
| `unsafe_or_high_risk` | 일반 회원에게 부상 위험. 코치 감독 또는 대체 미션으로 전환 |

### 운영 규칙

1. 실존 복서 이름 / 사진 / 영상 / 실제 명언 / 경기 영상 / 영화·만화 장면은 **MVP seed 데이터에 직접 넣지 않는다**.
2. 실존 선수·영화·만화 관련 콘텐츠는 `rights_review_required` 상태로 관리한다.
3. 위험한 명장면 챌린지는 **9번 섹션의 안전 변환표**에 따라 변환 후 구현한다.
4. 일반 회원에게 위험한 동작은 **코치 감독 확인 또는 대체 미션**으로 전환한다.
5. 음악 / BGM도 라이선스 검토 — 자체 제작 또는 공유 저작물(CC0)만 v1 진입 허용.

---

## 9. 명장면 챌린지 안전 변환표

| 원본 (rights_review_required + safety_review_required) | 안전 변환 (original_safe) |
|---|---|
| 알리 셔플 | **풋워크 리듬 챌린지** — 메트로놈 박자에 맞춘 좌우 스텝 |
| 타이슨 피커부 | **강철 가드 + 짧은 전진 스텝 챌린지** — 고개 숙이지 않고 가드 유지 |
| 록키 한 손 푸시업 | **기본/무릎 푸시업 챌린지** — 정자세 위주 |
| 메이웨더 숄더롤 | **방어 원리 퀴즈 + 가드 유지 챌린지** — 동작 따라 하기 X |
| 뎀프시롤 | **좌우 위빙 리듬 챌린지** — 짧은 폭으로 |
| 파퀴아오 윕 펀치 | **회전 원리 퀴즈 + 안전한 원투 리듬 챌린지** |
| 이노우에 더블 잽 콤보 | **더블 잽 정확도 챌린지** — 횟수보다 정확도 중심 |

> **원칙**: 어떤 명장면도 직접 재현하지 않는다. "원리만 추출 → 일반 회원에게 안전한 동작으로 변환".

---

## 10. 단계별 구현 로드맵

### v1 — `implement_now`
- 오삼이 오늘의 브리핑
- 복싱 IQ 퀴즈 (OX + 객관식)
- 재미 챌린지 (스쿼트·푸시업·잽·줄넘기·개인 챌린지)
- 세컨드 응원 기본형 (박수·스티커·일일 한도)
- 챔피언 일기 (1줄 회고 + 사진)
- 나만의 복싱 전당 요약 카드 (MyPage)
- QUEST XP / 파이트 머니 / RP 보조 보상 구조
- 공식 1~40레벨 시스템 보호 (코드/DB 미터치)

### v1.5 — `backlog_v1_5`
- 컨디션 선택
- 리턴 라운드 (복귀 환영)
- 숨겨진 미션
- 복싱 스타일 진단
- 복싱 IQ 리그
- 푸시 알림 문구 풀
- 성장 리포트 (주간 PDF / talktalk)

### v2 — `backlog_v2`
- 코너맨 매칭
- 그림자 복서 v0
- 팀 레이드 (지점 단위)
- 코치 대시보드 (회원 QUEST 활동 모니터링)
- 응원 랭킹
- 성장률 랭킹 확장

### v2.5 — `backlog_v2_5`
- 시즌 파이트 캠프 (4주 시즌)
- 시즌 스토리 패스
- 복싱 전당 확장 (카드/배지/일기 통합)
- 카드 수집 시스템 (자체 제작 카드부터)
- 챌린지 도전장 (친구 챌린지)

### v3 — `backlog_v3`
- 라이벌 매칭 4주 시즌
- 블랙 한정 트레이너 시스템
- 오삼이 라디오
- 레전드 콘텐츠 (`rights_review_required` 클리어 후)
- 명장면 챌린지 (9번 섹션 안전 변환 후)
- 체육관 현장 연동 이벤트

---

## 11. v1에서 실제 구현할 최소 범위 (`implement_now`)

| 기능 | 핵심 산출물 | 비고 |
|---|---|---|
| 오삼이 오늘의 브리핑 카드 | HomePage 진입 즉시 정적 카드 1개 | 일자별 결정적 시드 |
| 복싱 IQ 퀴즈 MVP | OX + 객관식 30문항 seed (자체 제작) | 신규 테이블 + RPC |
| 재미 챌린지 MVP | 5종(스쿼트·푸시업·잽·줄넘기·개인) | 신규 테이블, 기존 `/challenges` 와 분리 |
| 세컨드 응원 MVP | 박수 + 응원 스티커 (일일 한도) | 신규 테이블 |
| 챔피언 일기 MVP | 1줄 회고 + 사진 1장 (선택) | 신규 테이블, 본인만 SELECT |
| MyPage 복싱 전당 요약 카드 | 일기/배지/카드 카운트 | read-only 집계 |
| QUEST XP / RP / 파이트 머니 보조 보상 | `quest_xp_events`, `rp_wallets` 신규 + `grant_gems` 재사용 | 공식 XP 무영향 |
| 공식 레벨 XP와 QUEST XP 분리 | 별도 테이블·RPC·UI 진행 바 | 절대 통합 X |

---

## 12. v1에서 절대 구현하지 않을 것

| 항목 | 사유 | 상태 태그 |
|---|---|---|
| 공식 1~40레벨 훈련 리스트 수정 | 별도 프로젝트 | `official_level_future_work` |
| 공식 보스전 내용 수정 | 보호 영역 | `official_level_future_work` |
| 실존 선수·영화·만화 seed 데이터 삽입 | 권리 미확인 | `rights_review_required` |
| 영상 인증 (자세 분석 영상 업로드 채점) | 인프라 부담 + 안전 | `backlog_v3` |
| AI 자세 분석 | 인프라 부담 + 정확도 | `backlog_v3` |
| 라이벌 매칭 알고리즘 | 데이터 누적 후 | `backlog_v3` |
| 블랙 트레이너 시스템 | Black 진입자 데이터 누적 후 | `backlog_v3` |
| 오삼이 라디오 | 음성 콘텐츠 인프라 | `backlog_v3` |
| 300장 카드 전체 구현 | 권리 + 콘텐츠 제작 시간 | `backlog_v2_5` ~ `backlog_v3` |
| 시즌 스토리 패스 전체 구현 | 시즌 운영 검증 후 | `backlog_v2_5` |

---

## 13. 최종 체크리스트

- [x] **공식 1~40레벨 보호 여부** — 본 문서 2번 섹션 / 12번 섹션 / 보호 RPC·훅·테이블 명시.
- [x] **공식 XP와 QUEST XP 분리 여부** — 11번 섹션·QUEST XP 별도 테이블 / 별도 진행 바 / 별도 RPC.
- [x] **실존 콘텐츠 권리 검토 상태 표시 여부** — 8번 권리 처리 4단계 / 4·5·6번 표에서 `rights_review_required` 명시.
- [x] **위험 챌린지 안전 변환 여부** — 9번 명장면 안전 변환표 7개 항목.
- [x] **v1/v1.5/v2/v2.5/v3 단계 분리 여부** — 10번 단계별 구현 로드맵.
- [x] **이번 단계에서 코드 / DB 미수정 여부** — `docs/153-quest-full-engagement-roadmap.md` 1개 파일만 신규 생성. `src/`, `supabase/`, `migrations/`, `package.*` 무수정.

---

> **다음 단계 (3단계)**: 본 백로그 중 v1 `implement_now` 8개 항목 중 **첫 1~2개 (예: QUEST XP 인프라 + 오삼이 브리핑)** 부터 마이그레이션·캐시키·UI 카드를 작은 단위로 순차 구현. 직전 1단계 분석 결과 + 본 2단계 백로그를 참조해 충돌 없이 진행한다.
