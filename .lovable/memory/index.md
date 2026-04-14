# Project Memory

## Core
153 QUEST: 복싱 테마 모바일 우선 레벨업 앱. 한국어 UI.
Primary #E8553A (orange-red), accent gold. Light theme. Black Han Sans display, Noto Sans KR body.
복싱 용어 사용 (잽, 훅, 스파링, 타이틀매치). 칼/전사/마법사 금지.
하단 탭 4개: 홈, 퀘스트, 레벨맵, 보상. 마이페이지는 우상단 아이콘.
Lovable Cloud 연동 완료. user_roles 테이블로 역할 관리 (member/coach/admin).
RLS: 회원=자기데이터, 코치=담당회원, 관리자=전체.
링젬 경제 시스템: 미션/퀘스트/출석/보스전에서 자동 지급.

## Memories
- [Boxing theme](mem://constraints/boxing-theme) — RPG 용어 금지, 복싱 용어만 사용
- [Page structure](mem://features/pages) — 7 pages: Login, Home, Quests, LevelMap, Rewards, MyPage, CoachDashboard
- [DB schema](mem://features/db-schema) — 10 tables with RLS, role-based access
- [Avatar & Gems](mem://features/avatar-gems) — 캐릭터 꾸미기 + 링젬 경제 시스템, 6 테이블, 자동 지급 연동
