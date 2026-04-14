---
name: 캐릭터 파츠 시스템
description: 치비 복서 캐릭터 프리셋 12종, 캐릭터 스튜디오, 명예의전당 레일, 회원별 할당, 블랙 리그 레인보우 후광
type: feature
---
- DB: character_part_categories, character_parts, character_presets, member_character_assignments
- 프리셋 12종: male 6 + female 6, 각각 다른 색상/스타일
- /character-studio 페이지에서 선택 & 저장
- HallOfFameShowcase에 CharacterRail 통합
- CharacterSprite: xs/sm/md/lg 사이즈 렌더링, league/level prop으로 자동 아우라
- BlackLeagueAura: CSS conic-gradient 레인보우 후광 (compact/detail 모드)
  - compact: 얇은 링 + 약한 글로우 (rail용)
  - detail: 풀 애니메이션 + 스파클 (프로필/빌더용)
  - master: 이중 후광 + 강화 효과 (Black Lv.10+)
- getCharacterByHash(): userId 기반 deterministic fallback
- 관리자/branch_manager가 회원에 캐릭터 할당 가능
- SDBoxerCharacter(라이브보드)에도 BlackLeagueAura 적용
- prefers-reduced-motion 지원
