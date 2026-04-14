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
캐릭터: 12 PNG 프리셋 스타일 락. preset_customization_variants DB로 프리셋별 파츠 관리.

## Memories
- [Boxing theme](mem://constraints/boxing-theme) — RPG 용어 금지, 복싱 용어만 사용
- [League terminology](mem://constraints/league-terminology) — 리그 용어 규칙
- [Page structure](mem://features/pages) — 7 pages with routing and navigation rules
- [DB schema](mem://features/db-schema) — 10 tables with role-based RLS policies
- [Character customization v4](mem://features/character-customization-v4) — Preset-specific PNG parts system via DB
- [Character parts](mem://features/character-parts) — Part categories and layered renderer
- [Character unified](mem://features/character-unified) — Unified character system
- [Avatar gems](mem://features/avatar-gems) — Gem-based avatar shop
- [Guide onboarding](mem://features/guide-onboarding) — Guide and onboarding system
