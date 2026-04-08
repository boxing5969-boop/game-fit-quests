# Project Memory

## Core
153랭크업 시스템: 복싱 테마 모바일 우선 레벨업 앱. 한국어 UI.
Primary #E8553A (orange-red), accent gold. Light theme. Black Han Sans display, Noto Sans KR body.
복싱 용어 사용 (잽, 훅, 스파링, 타이틀매치). 칼/전사/마법사 금지. "벨트" 표현 금지.
랭크 표기: "화이트 레벨 1" 형식. 중복표기 금지.
하단 탭 6개: 홈, 미션, 계급도, 랭킹, 보상, 단증혜택. 마이페이지는 우상단 아이콘.
Lovable Cloud 연동. user_roles: member/branch_manager/super_admin (legacy: coach/admin).
RLS: 회원=자기데이터, branch_manager=같은 지점, super_admin=전체.
로그인 분기: member→/home, branch_manager→/manager, super_admin→/manager.

## Memories
- [Boxing theme](mem://constraints/boxing-theme) — RPG 용어 금지, 복싱 용어만 사용
- [Page structure](mem://features/pages) — 7 pages: Login, Home, Quests, LevelMap, Rewards, MyPage, CoachDashboard
- [DB schema](mem://features/db-schema) — 10 tables with RLS, role-based access
