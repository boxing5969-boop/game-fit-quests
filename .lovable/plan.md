## Phase 1: Database Migration
- `missions` 테이블 (레벨별 미션, 영상 URL, 썸네일, 난이도, 핵심포인트)
- `mission_videos` 테이블 (영상 소스, poster, source_type)
- `hidden_mastery` 테이블 (technique/conditioning/teaching/safety/evaluation scores)
- `external_cert_progress` 테이블 (dan4_ready, examiner_ready, coach_cert_ready 등)
- `mission_submissions` 테이블 (기존 quest_submissions 대체/보완)
- RLS: 회원=자기데이터, 코치/관리자=담당회원, hidden_mastery/cert는 코치/관리자만

## Phase 2: Core Components
- `VideoPlayer` 컴포넌트 (모달/전체화면, 재생/일시정지/배속, fallback UI)
- `MissionCard` 컴포넌트 (썸네일, 난이도, XP, 미션보기/도전시작 버튼)
- `LevelNode` 컴포넌트 (계급도용 노드, 잠금/현재/완료 상태)

## Phase 3: Pages Rebuild
- **홈**: 계급/레벨, XP바, 오늘의 미션, 추격대상 3명, 연속출석, 최근배지
- **미션**: 레벨별 미션 목록 + 영상 재생 모달
- **계급도**: 40개 노드 맵, 보스전 강조
- **보상**: 배지, 칭호, 레벨업 기록, MASTER 40

## Phase 4: Coach/Admin Dashboard
- 회원별 hidden mastery 점수 카드
- 외부자격 준비도 카드 (dan4/examiner/coach_cert)
- 블랙10 클리어 시 내부 상태 표시

## Phase 5: Hooks & Data Layer
- `useMissions`, `useMissionSubmissions` 훅
- `useHiddenMastery` (코치/관리자 전용)
- 기존 훅 연동