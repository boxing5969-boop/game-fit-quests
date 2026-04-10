# Project Memory

## Core
153 QUEST: 복싱 테마 모바일 우선 레벨업 앱. 한국어 UI.
Primary #E8553A (orange-red), accent gold. Light theme. Black Han Sans display, Noto Sans KR body.
복싱 용어 사용 (잽, 훅, 스파링, 타이틀매치). 칼/전사/마법사 금지.
"계급" 금지 → "리그"로 통일. "벨트" 금지. 4리그×10레벨=40레벨.
하단 탭 5개: 홈, 훈련, 랭크업, 가이드, 내정보.
Lovable Cloud 연동 완료. user_roles 테이블로 역할 관리 (member/coach/admin).
RLS: 회원=자기데이터, 코치=담당회원, 관리자=전체.

## Memories
- [Boxing theme](mem://constraints/boxing-theme) — RPG 용어 금지, 복싱 용어만 사용
- [League terminology](mem://constraints/league-terminology) — "계급"→"리그" 전면 변경, 표기 규칙
- [Page structure](mem://features/pages) — 7 pages: Login, Home, Quests, LevelMap, Rewards, MyPage, CoachDashboard
- [DB schema](mem://features/db-schema) — 10 tables with RLS, role-based access
- [Guide & Onboarding](mem://features/guide-onboarding) — 온보딩 6화면, 가이드 허브, 주간 대시보드, 가치맵, 안전체크, 운동이유
