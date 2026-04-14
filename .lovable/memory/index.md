# Memory: index.md
Updated: now

# Project Memory

## Core
153 QUEST: 복싱 테마 모바일 우선 레벨업 앱. 한국어 UI.
Primary #E8553A (orange-red), accent gold. Light theme. Black Han Sans display, Noto Sans KR body.
복싱 용어 사용 (잽, 훅, 스파링, 타이틀매치). 칼/전사/마법사 금지.
하단 탭 4개: 홈, 퀘스트, 레벨맵, 보상. 마이페이지는 우상단 아이콘.
Lovable Cloud 연동 완료. user_roles 테이블로 역할 관리 (member/coach/admin).
RLS: 회원=자기데이터, 코치=담당회원, 관리자=전체.

## Memories
- [Boxing theme](mem://constraints/boxing-theme) — RPG 용어 금지, 복싱 용어만 사용
- [League terminology](mem://constraints/league-terminology) — 리그 용어 규칙
- [Page structure](mem://features/pages) — 7 pages: Login, Home, Quests, LevelMap, Rewards, MyPage, CoachDashboard
- [DB schema](mem://features/db-schema) — 10 tables with RLS, role-based access
- [Character parts](mem://features/character-parts) — SVG 레이어 + 81파츠 + 프리셋 듀얼 모드
- [Character unified](mem://features/character-unified) — PNG 프리셋 고정, SVG 숨김, 스튜디오 허브
- [Character customization v3](mem://features/character-customization-v3) — PNG 이미지 오버레이 + 프리셋별 앵커 맵
- [Avatar gems](mem://features/avatar-gems) — 젬 화폐 + 아바타 상점
- [Guide onboarding](mem://features/guide-onboarding) — 가이드 페이지 + 온보딩 플로우
